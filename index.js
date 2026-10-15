const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req,res)=>res.send('Bot online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const STORE = process.env.ROBLOX_DATASTORE || 'PrivateDataUsersASync';

// NEVER allow these out
const BLOCKED_KEYS = ['password','pass','backup','code','token','acsession','secret','recovery'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [...obj] : {...obj};
  for (const k of Object.keys(clean)) {
    const low = k.toLowerCase();
    if (BLOCKED_KEYS.some(b => low.includes(b))) {
      clean[k] = '[HIDDEN]';
    } else if (typeof clean[k] === 'object') {
      clean[k] = sanitize(clean[k]);
    }
  }
  // always hide these specifically from your ServerMain
  if (clean.ACSession) clean.ACSession = '[HIDDEN]';
  return clean;
}

async function getUserId(input) {
  if (/^\d+$/.test(input)) return input; // already ID
  const r = await fetch('https://users.roblox.com/v1/usernames/users', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({usernames:[input], excludeBannedUsers:true})
  });
  const j = await r.json();
  if (!j.data || !j.data[0]) throw new Error('user not found');
  return String(j.data[0].id);
}

async function getProfile(userId) {
  const [u, t] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${userId}`).then(r=>r.json()),
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json())
  ]);
  return { name: u.name, display: u.displayName, thumb: t.data?.[0]?.imageUrl };
}

async function getDataStore(userId) {
  const key = `Player_${userId}`;
  // v1 standard-datastore - simplest for ProfileStore
  const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${STORE}&entryKey=${key}&scope=global`;
  const r = await fetch(url, { headers:{'x-api-key': API_KEY} });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Roblox API ${r.status}`);
  return await r.json();
}

client.once('ready', ()=>console.log(`Logged in as ${client.user.tag}`));

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (msg.content === '!ping') msg.reply('pong!');

  if (msg.content.startsWith('!fetch')) {
    const args = msg.content.split(' ').slice(1);
    if (!args[0]) return msg.reply('Usage: `!fetch <roblox username or userId>`');

    // OPTIONAL: restrict to staff only - uncomment:
    // if (!msg.member.permissions.has('ManageGuild')) return msg.reply('Staff only.');

    try {
      const userId = await getUserId(args[0]);
      const profile = await getProfile(userId);
      const rawData = await getDataStore(userId);
      if (!rawData) return msg.reply(`No data found for **${profile.name}** (${userId})`);

      const data = sanitize(rawData);
      const money = data.Money ?? '0';
      const slays = data.Slays ?? '0';

      const embed = new EmbedBuilder()
        .setTitle(`${profile.display} (@${profile.name})`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(profile.thumb || null)
        .addFields(
          { name:'UserId', value:String(userId), inline:true },
          { name:'Money / Dinero', value:String(money), inline:true },
          { name:'Slays', value:String(slays), inline:true },
          { name:'Tokens', value:String(data.NewInventory?.Tokens ?? data.Underground?.NewTokens ?? 0), inline:true },
          { name:'Spins', value:String(data.SpinWheel?.Spins ?? 0), inline:true },
          { name:'Inventory Items', value:String(Object.keys(data.NewInventory?.Items?.Weapon || {}).length + Object.keys(data.Inventory || {}).length), inline:true },
        )
        .setDescription('```json\n' + JSON.stringify({Money:data.Money, Slays:data.Slays, RAPs:data.RAPs, Tokens:data.NewInventory?.Tokens, PlaytimeClaimed:Object.keys(data.PlaytimeClaimed||{}).length}, null, 2).slice(0, 900) + '\n```')
        .setFooter({text:'Passwords / backup codes are never shown'});

      msg.reply({embeds:[embed]});
    } catch(e) {
      console.error(e);
      msg.reply('Failed to fetch: ' + e.message);
    }
  }
});

client.login(process.env.TOKEN);
