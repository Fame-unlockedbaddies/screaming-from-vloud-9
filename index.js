console.log('>>> BOT FILE LOADED <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`>>> WEB ON ${PORT} <<<`));

const TOKEN = (process.env.TOKEN || '').trim();
const SECRET = process.env.ROBLOX_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';

const cache = new Map();
const cooldown = new Map();
const IGNORE = ['punches','punch','spray','wallet','fists'];

function weaponImageUrl(w, thumbMap){
  // 1) thumbnails API CDN 2) direct asset-thumbnail fallback 3) none
  if(w.iconAsset && thumbMap[String(w.iconAsset)]) return thumbMap[String(w.iconAsset)];
  if(w.iconAsset) return `https://www.roblox.com/asset-thumbnail/image?assetId=${w.iconAsset}&width=150&height=150&format=png`;
  if(w.icon){
    const id = String(w.icon).match(/\d+/);
    if(id) return `https://www.roblox.com/asset-thumbnail/image?assetId=${id[0]}&width=150&height=150&format=png`;
  }
  return null;
}

async function thumbBatch(ids){
  const map={};
  for(let i=0;i<ids.length;i+=40){
    try{
      const r=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i,i+40).join(',')}&size=150x150&format=Png`).then(r=>r.json());
      for(const d of (r.data||[])){
        if(d.imageUrl && d.imageUrl.includes('http')) map[String(d.targetId)]=d.imageUrl;
      }
    }catch(e){ console.error('thumb',e.message); }
  }
  return map;
}

async function sendToCloud(userId, entry){
  try{
    const data=entry.data||{};
    const dinero=data.Money??0, tokens=data.NewInventory?.Tokens??0;
    const weapons=entry.weapons||[];
    const thumbMap=await thumbBatch([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);
    const fields=[
      {name:'💵 Dinero', value:String(dinero), inline:true},
      {name:'🪙 Trade Tokens', value:String(tokens), inline:true},
      {name:'🔪 Weapons', value:String(weapons.length), inline:true},
    ];
    // first 5 weapons with icons in webhook
    for(const w of weapons.slice(0,5)){
      fields.push({name:`${w.name} (${w.rarity})`, value:weaponImageUrl(w,thumbMap)?`[icon](${weaponImageUrl(w,thumbMap)})`:'no icon', inline:true});
    }
    await fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Backup Cloud',embeds:[{title:`☁️ ${entry.username} (${userId})`,url:`https://www.roblox.com/users/${userId}/profile`,color:0x5865F2,fields}]})});
  }catch(e){ console.error(e.message); }
}

app.post('/roblox-data', (req, res) => {
  try{
    if(req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
    const {userId, username, avatar, data, backup, weapons, reason} = req.body||{};
    if(!userId||!data) return res.status(400).send('missing');
    const isNew=!cache.has(String(userId));
    const cleanW=(weapons||[]).filter(w=>{
      const n=String(w.name||'').toLowerCase();
      return n && !IGNORE.some(i=>n.includes(i));
    }).slice(0,100);
    const entry={username, avatar, data, backup, weapons:cleanW, updatedAt:Date.now()};
    cache.set(String(userId), entry);
    if(isNew) sendToCloud(String(userId), entry);
    return res.send('ok');
  }catch{ return res.status(500).send('err'); }
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, ()=>console.log(`✅ Logged in as ${client.user.tag}`));

function getDinero(d){ return d.Money ?? 0; }
function getTokens(d){ try{ return d.NewInventory?.Tokens ?? 0; }catch{ return 0; } }

client.on(Events.MessageCreate, async msg=>{
  try{
    if(msg.author.bot) return;
    if(msg.content==='!ping') return void await msg.reply('pong!').catch(()=>{});
    if(msg.content==='!all'){
      if(!cache.size) return void await msg.reply('No pushes yet.').catch(()=>{});
      return void await msg.reply([...cache.entries()].map(([id,v])=>`${v.username} (${id}) - ${v.weapons.length}w`).join('\n').slice(0,1800)).catch(()=>{});
    }
    if(!msg.content.startsWith('!fetch')) return;
    if(Date.now()-(cooldown.get(msg.author.id)||0)<3000) return void await msg.reply('Wait 3s').catch(()=>{});
    cooldown.set(msg.author.id, Date.now());
    const arg=msg.content.split(/\s+/)[1];
    if(!arg) return void await msg.reply('`!fetch <name or Id>`').catch(()=>{});
    let entry,userId=String(arg);
    entry=cache.get(userId);
    if(!entry) for(const [id,v] of cache){ if(v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;} }
    if(!entry) return void await msg.reply(`No data`).catch(()=>{});

    const dinero=getDinero(entry.data), tokens=getTokens(entry.data);
    const weapons=entry.weapons||[];
    const thumbMap=await thumbBatch([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);

    let thumb=entry.avatar;
    try{
      if(!thumb){
        const t=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb=t.data?.[0]?.imageUrl;
      }
    }catch{}

    const main=new EmbedBuilder().setTitle(`${entry.username} (${userId})`).setURL(`https://www.roblox.com/users/${userId}/profile`)
      .addFields(
        {name:'💵 Dinero', value:String(dinero), inline:true},
        {name:'🪙 Trade Tokens', value:String(tokens), inline:true},
        {name:'🔪 Weapons', value:String(weapons.length), inline:true},
      );
    if(thumb) main.setThumbnail(thumb);
    if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join', value:`<t:${entry.backup.savedAt}:R>`, inline:false});

    const all=[main];
    for(const w of weapons){ // ALL weapons, each with icon from Weapons module
      const img=weaponImageUrl(w, thumbMap);
      const e=new EmbedBuilder().setTitle(`${w.name}`).setDescription(`${w.rarity||''}`);
      if(img) e.setThumbnail(img);
      else e.setDescription(`${w.rarity||''}\nicon:${w.iconAsset||'?'}`);
      all.push(e);
    }
    for(let i=0;i<all.length;i+=10){
      await msg.reply({embeds:all.slice(i,i+10)}).catch(()=>{});
      if(i+10<all.length) await new Promise(r=>setTimeout(r,600));
    }
  }catch(e){ console.error(e.message); }
});

if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error(e.message));
