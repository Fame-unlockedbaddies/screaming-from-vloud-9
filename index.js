console.log('>>> BOT STARTING <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

console.log('TOKEN?', !!process.env.TOKEN);
console.log('SECRET?', !!process.env.ROBLOX_SECRET);

const SECRET = process.env.ROBLOX_SECRET;
const cache = new Map(); // userId -> {username, avatar, data, backup, weapons, updatedAt}
const IGNORE_WEAPONS = ['punches','punch','spray','wallet','fists'];

app.post('/roblox-data', (req, res) => {
  if (req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
  const { userId, username, avatar, data, backup, weapons } = req.body || {};
  if (!userId || !data) return res.status(400).send('missing');
  const cleanW = (weapons || []).filter(w => {
    const n = String(w.name || '').toLowerCase();
    return n && !IGNORE_WEAPONS.some(i => n.includes(i));
  }).slice(0, 30);
  cache.set(String(userId), { username, avatar, data, backup, weapons: cleanW, updatedAt: Date.now() });
  console.log(`push ${userId} ${username} weapons:${cleanW.length} backup:${backup?.reason || 'none'}`);
  res.send('ok');
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, () => console.log(`✅ Logged in as ${client.user.tag}`));
client.on(Events.Error, e => console.error(e));

const BLOCKED = ['password','pass','backup','code','token','acsession','secret','recovery'];
function sanitize(o){
  if(!o || typeof o!=='object') return o;
  const c = Array.isArray(o)?[...o]:{...o};
  for(const k of Object.keys(c)){
    if(BLOCKED.some(b=>k.toLowerCase().includes(b))) c[k]='[HIDDEN]';
    else if(typeof c[k]==='object') c[k]=sanitize(c[k]);
  }
  if(c.ACSession) c.ACSession='[HIDDEN]';
  return c;
}

async function assetToThumb(ids){
  const map = {};
  for(let i=0;i<ids.length;i+=50){
    const batch = ids.slice(i,i+50).join(',');
    try{
      const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${batch}&size=150x150&format=Png`).then(r=>r.json());
      for(const d of (r.data||[])) if(d.imageUrl) map[String(d.targetId)] = d.imageUrl;
    }catch(e){ console.error(e.message); }
  }
  return map;
}

client.on(Events.MessageCreate, async msg => {
  if(msg.author.bot) return;
  if(msg.content === '!ping') return msg.reply('pong!');
  if(msg.content === '!all' || msg.content === '!cache'){
    if(!cache.size) return msg.reply('No pushes yet. Join game first.');
    return msg.reply([...cache.entries()].slice(0,20).map(([id,v])=>`${v.username} (${id}) - ${v.weapons?.length??0} weapons`).join('\n'));
  }
  if(msg.content.startsWith('!fetch')){
    const arg = msg.content.split(' ').slice(1)[0];
    if(!arg) return msg.reply('Usage: `!fetch <roblox name or Id>`');
    let entry, userId = String(arg);
    entry = cache.get(userId);
    if(!entry) for(const [id,v] of cache){ if(v.username?.toLowerCase()===String(arg).toLowerCase()){ entry=v; userId=id; break; } }
    if(!entry) return msg.reply(`No data for \`${arg}\`. They must join Unlock It once. Cached: ${cache.size}`);

    const data = sanitize(entry.data);
    const weapons = entry.weapons || [];
    const thumbMap = await assetToThumb([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);

    let thumb = entry.avatar;
    try{
      if(!thumb){
        const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb = t.data?.[0]?.imageUrl;
      }
    }catch{}

    const main = new EmbedBuilder()
      .setTitle(`${entry.username} (${userId})`)
      .setURL(`https://www.roblox.com/users/${userId}/profile`)
      .setThumbnail(thumb||null)
      .addFields(
        {name:'Money', value:String(data.Money??0), inline:true},
        {name:'Slays', value:String(data.Slays??0), inline:true},
        {name:'Weapons', value:String(weapons.length), inline:true},
      );
    if(entry.backup) main.addFields({name:'☁️ Backup Cloud First-Join', value:`${entry.backup.reason||'first-join'} <t:${entry.backup.savedAt||0}:R>`, inline:false});

    const embeds = [main];
    for(const w of weapons.slice(0,9)){
      const img = thumbMap[String(w.iconAsset)];
      const e = new EmbedBuilder().setTitle(w.name).setDescription(w.rarity||'');
      if(img) e.setThumbnail(img);
      embeds.push(e);
    }
    if(weapons.length>9) embeds[0].addFields({name:'+ more', value:`+${weapons.length-9} more`, inline:false});

    return msg.reply({embeds});
  }
});

if(!process.env.TOKEN) console.error('❌ NO TOKEN');
else client.login(process.env.TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
