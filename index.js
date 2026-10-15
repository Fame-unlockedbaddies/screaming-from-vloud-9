console.log('>>> BOOT <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('WEB ON ' + PORT));

const TOKEN = (process.env.TOKEN || '').trim();
const SECRET = process.env.ROBLOX_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';

const cache = new Map();
const IGNORE = ['punches','punch','spray','wallet','fists'];

// Discord client - this print never removed
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

app.post('/roblox-data', (req, res) => {
  if (req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
  const { userId, username, avatar, data, backup, weapons } = req.body || {};
  if (!userId || !data) return res.status(400).send('missing');
  const cleanW = (weapons || []).filter(w => {
    const n = String(w.name || '').toLowerCase();
    return n && !IGNORE.some(i => n.includes(i));
  }).slice(0, 100);
  const isNew = !cache.has(String(userId));
  cache.set(String(userId), { username, avatar, data, backup, weapons: cleanW, updatedAt: Date.now() });
  if (isNew) {
    fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `☁️ ${username} (${userId}) joined - Dinero: ${data.Money ?? 0} Tokens: ${data.NewInventory?.Tokens ?? 0} Weapons: ${cleanW.length}` }) }).catch(() => {});
  }
  res.send('ok');
});

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (msg.content === '!ping') return void await msg.reply('pong!').catch(()=>{});
  if (!msg.content.startsWith('!fetch')) return;
  const arg = msg.content.split(/\s+/)[1];
  if (!arg) return void await msg.reply('`!fetch <name or Id>`').catch(()=>{});
  let entry, userId = String(arg);
  entry = cache.get(userId);
  if (!entry) for (const [id,v] of cache) if (v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;}
  if (!entry) return void await msg.reply('No data yet').catch(()=>{});
  const dinero = entry.data.Money ?? 0;
  const tokens = entry.data.NewInventory?.Tokens ?? 0;
  const weapons = entry.weapons || [];
  const main = new EmbedBuilder().setTitle(`${entry.username} (${userId})`).setURL(`https://www.roblox.com/users/${userId}/profile`)
    .addFields({name:'💵 Dinero',value:String(dinero),inline:true},{name:'🪙 Trade Tokens',value:String(tokens),inline:true},{name:'🔪 Weapons',value:String(weapons.length),inline:true});
  if (entry.avatar) main.setThumbnail(entry.avatar);
  const embeds = [main];
  for (const w of weapons.slice(0,9)) {
    const e = new EmbedBuilder().setTitle(w.name).setDescription(w.rarity||'');
    if (w.iconAsset) {
      try{
        const tr = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${w.iconAsset}&size=150x150&format=Png`).then(r=>r.json());
        if (tr.data?.[0]?.imageUrl) e.setThumbnail(tr.data[0].imageUrl);
        else e.setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${w.iconAsset}&width=150&height=150&format=png`);
      }catch{}
    }
    embeds.push(e);
  }
  await msg.reply({embeds}).catch(()=>{});
});

console.log('>>> LOGGING IN <<<');
client.login(TOKEN).then(()=>console.log('login sent')).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
