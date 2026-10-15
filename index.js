const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

// --- Keep Render alive ---
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

console.log('--- ENV CHECK ---');
console.log('TOKEN exists?', !!process.env.TOKEN);
console.log('ROBLOX_API_KEY exists?', !!process.env.ROBLOX_API_KEY);
console.log('ROBLOX_UNIVERSE_ID:', process.env.ROBLOX_UNIVERSE_ID || 'MISSING');
console.log('ROBLOX_DATASTORE:', process.env.ROBLOX_DATASTORE || 'MISSING');
console.log('Node:', process.version);

const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID; // Teleporter = 10770699965
const API_KEY = process.env.ROBLOX_API_KEY;
const STORE = process.env.ROBLOX_DATASTORE || 'PrivateDataUsersASync';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on(Events.Error, console.error);

// --- NEVER show these ---
const BLOCKED_KEYS = ['password','pass','backup','code','token','acsession','secret','recovery'];
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [...obj] : {...obj};
  for (const k of Object.keys(clean)) {
    const low = k.toLowerCase();
    if (BLOCKED_KEYS.some(b => low.includes(b))) clean[k] = '[HIDDEN]';
    else if (typeof clean[k] === 'object') clean[k] = sanitize(clean[k]);
  }
  if (clean.ACSession) clean.ACSession = '[HIDDEN]';
  return clean;
}

async function getUserId(input) {
  if (/^\d+$/.test(input)) return input;
  const r = await fetch('https://users.roblox.com/v1/usernames/users', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({usernames:[input], excludeBannedUsers:true})
  });
  const j = await r.json();
  if (!j.data || !j.data[0]) throw new Error('roblox user not found');
  return String(j.data[0].id);
}

async function getProfile(userId) {
  const [u, t] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${userId}`).then(r=>r.json()),
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json())
  ]);
  return { name: u.name, display: u.displayName, thumb: t.data?.[0]?.imageUrl };
}

// --- v2 Cloud (matches your Teleporter universe-datastores perms) ---
async function getDataStore(userId) {
  const key = `Player_${userId}`;
  const storeEnc = encodeURIComponent(STORE);
  const keyEnc = encodeURIComponent(key);
  const url = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/data-stores/${storeEnc}/scopes/global/entries/${keyEnc}`;
  const r = await fetch(url, { headers:{'x-api-key': API_KEY} });
  if (r.status === 404) return null;
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Roblox API ${r.status} - ${txt.slice(0,300)}`);
  }
  const j = await r.json();
  return j.value ?? j;
}

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (msg.content === '!ping') return msg.reply('pong!');

  if (msg.content.startsWith('!fetch')) {
    const args = msg.content.split(' ').slice(1);
    if (!args[0]) return msg.reply('Usage: `!fetch <roblox username or userId>`');
    try {
      const userId = await getUserId(args[0]);
      const profile = await getProfile(userId);
      const rawData = await getDataStore(userId);
      if (!rawData) return msg.reply(`No data found for **${profile.name}** (${userId})`);
      const data = sanitize(rawData);
      const embed = new EmbedBuilder()
        .setTitle(`${profile.display} (@${profile.name})`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(profile.thumb || null)
        .addFields(
          { name:'UserId', value:String(userId), inline:true },
          { name:'Money / Dinero', value:String(data.Money ?? 0), inline:true },
          { name:'Slays', value:String(data.Slays ?? 0), inline:true },
        )
        .setDescription('```json\n' + JSON.stringify({Money:data.Money, Slays:data.Slays, RAPs:data.RAPs}, null, 2).slice(0,900) + '\n```')
        .setFooter({text:'Passwords / backup codes never shown'});
      await msg.reply({embeds:[embed]});
    } catch(e) {
      console.error(e);
      await msg.reply('Failed: ' + e.message);
    }
  }
});

client.login(process.env.TOKEN).catch(err => {
  console.error('❌ LOGIN FAILED:', err.message);
});

process.on('unhandledRejection', console.error);
