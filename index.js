console.log('>>> BOT FILE LOADED <<<');

const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`>>> WEB ON ${PORT} <<<`));

const TOKEN = (process.env.TOKEN || '').trim();
const SECRET = process.env.ROBLOX_SECRET;
console.log('TOKEN len:', TOKEN.length, 'SECRET?', !!SECRET);
console.log('Node', process.version);

const cache = new Map();
const cooldown = new Map();
const fetching = new Set();
const IGNORE_WEAPONS = ['punches','punch','spray','wallet','fists'];

app.post('/roblox-data', (req, res) => {
  try{
    if(req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
    const {userId, username, avatar, data, backup, weapons} = req.body||{};
    if(!userId||!data) return res.status(400).send('missing');
    const cleanW = (weapons||[]).filter(w=>{
      const n=String(w.name||'').toLowerCase();
      return n && !IGNORE_WEAPONS.some(i=>n.includes(i));
    }).slice(0,30);
    cache.set(String(userId), {username, avatar, data, backup, weapons:cleanW, updatedAt:Date.now()});
    return res.send('ok');
  }catch(e){ console.error(e.message); return res.status(500).send('err'); }
});

console.log('>>> CREATING DISCORD CLIENT <<<');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on(Events.Error, e=>console.error('discord err',e.message));

function getDinero(d){ return d.Money ?? d.Dinero ?? 0; }
function getTokens(d){ try{ return d.NewInventory?.Tokens ?? d.TokenAmount ?? 0; }catch{ return 0; } }

client.on(Events.MessageCreate, async msg => {
  try{
    if(msg.author.bot) return;
    if(msg.content==='!ping') return void await msg.reply('pong!').catch(()=>{});
    if(msg.content==='!all'){
      if(!cache.size) return void await msg.reply('No pushes yet.').catch(()=>{});
      return void await msg.reply([...cache.entries()].slice(0,20).map(([id,v])=>`${v.username} (${id})`).join('\n').slice(0,1800)).catch(()=>{});
    }
    if(!msg.content.startsWith('!fetch')) return;
    const now=Date.now();
    if(now-(cooldown.get(msg.author.id)||0)<3000) return void await msg.reply('Wait 3s').catch(()=>{});
    cooldown.set(msg.author.id,now);
    const arg=msg.content.split(/\s+/)[1];
    if(!arg) return void await msg.reply('`!fetch <name or Id>`').catch(()=>{});
    let entry, userId=String(arg);
    entry=cache.get(userId);
    if(!entry) for(const [id,v] of cache){ if(v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;} }
    if(!entry) return void await msg.reply(`No data for ${arg}. Cached:${cache.size}`).catch(()=>{});
    const data=entry.data||{};
    const dinero=getDinero(data), tokens=getTokens(data);
    const weapons=entry.weapons||[];
    let thumb=entry.avatar;
    try{
      if(!thumb){
        const t=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb=t.data?.[0]?.imageUrl;
      }
    }catch{}
    const main=new EmbedBuilder()
      .setTitle(`${entry.username} (${userId})`)
      .setURL(`https://www.roblox.com/users/${userId}/profile`)
      .addFields(
        {name:'💵 Dinero', value:String(dinero), inline:true},
        {name:'🪙 Trade Tokens', value:String(tokens), inline:true},
        {name:'🔪 Weapons', value:String(weapons.length), inline:true},
      );
    if(thumb) main.setThumbnail(thumb);
    if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join', value:`${entry.backup.reason||''} <t:${entry.backup.savedAt}:R>`, inline:false});
    const embeds=[main];
    for(const w of weapons.slice(0,9)){
      const e=new EmbedBuilder().setTitle(String(w.name).slice(0,100)).setDescription(String(w.rarity||''));
      if(w.iconAsset){
        try{
          const tr=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${w.iconAsset}&size=150x150&format=Png`).then(r=>r.json());
          if(tr.data?.[0]?.imageUrl) e.setThumbnail(tr.data[0].imageUrl);
        }catch{}
      }
      embeds.push(e);
    }
    await msg.reply({embeds}).catch(()=>{});
  }catch(e){ console.error(e.message); }
});

console.log('>>> LOGGING IN <<<');
if(!TOKEN) console.error('❌ NO TOKEN - add TOKEN in Render Environment then Save');
else client.login(TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));

process.on('unhandledRejection',e=>console.error('unhandled',e?.message));
