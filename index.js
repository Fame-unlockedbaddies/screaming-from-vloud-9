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
const cache = new Map();
const cooldown = new Map();
const IGNORE = ['punches','punch','spray','wallet','fists'];

app.post('/roblox-data', (req, res) => {
  try{
    if(req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
    const {userId, username, avatar, data, backup, weapons} = req.body||{};
    if(!userId||!data) return res.status(400).send('missing');
    const cleanW=(weapons||[]).filter(w=>{
      const n=String(w.name||'').toLowerCase();
      return n && !IGNORE.some(i=>n.includes(i));
    }).slice(0,100); // allow 100, not 30
    cache.set(String(userId), {username, avatar, data, backup, weapons:cleanW, updatedAt:Date.now()});
    return res.send('ok');
  }catch(e){ return res.status(500).send('err'); }
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, ()=>console.log(`✅ Logged in as ${client.user.tag}`));

// FIXED: do NOT hide Tokens. Only hide real secrets.
const BLOCKED = ['password','passwd','backupcode','backup_code','acsession','secretkey','recoverykey'];
function sanitize(o){
  if(!o||typeof o!=='object') return o;
  const c = Array.isArray(o)?[...o]:{...o};
  for(const k of Object.keys(c)){
    const low = k.toLowerCase();
    if(BLOCKED.some(b=>low.includes(b))) c[k]='[HIDDEN]';
    else if(typeof c[k]==='object') c[k]=sanitize(c[k]);
  }
  if(c.ACSession) c.ACSession='[HIDDEN]';
  if(c.Token && typeof c.Token==='string' && c.Token.length>20) c.Token='[HIDDEN]'; // hide session token string only, not Tokens count
  return c;
}

function getDinero(d){ return d.Money ?? d.Dinero ?? 0; }
function getTokens(d){
  try{
    if(d.NewInventory && d.NewInventory.Tokens != null) return d.NewInventory.Tokens;
    if(d.TokenAmount != null) return d.TokenAmount;
    if(d.Tokens != null && typeof d.Tokens==='number') return d.Tokens;
    return 0;
  }catch{ return 0; }
}

async function thumbBatch(ids){
  const map={};
  for(let i=0;i<ids.length;i+=40){
    try{
      const r=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i,i+40).join(',')}&size=150x150&format=Png`).then(r=>r.json());
      for(const d of (r.data||[])) if(d.imageUrl) map[String(d.targetId)]=d.imageUrl;
    }catch{}
  }
  return map;
}

client.on(Events.MessageCreate, async msg=>{
  try{
    if(msg.author.bot) return;
    if(msg.content==='!ping') return void await msg.reply('pong!').catch(()=>{});
    if(msg.content==='!all'){
      if(!cache.size) return void await msg.reply('No pushes yet.').catch(()=>{});
      return void await msg.reply([...cache.entries()].slice(0,20).map(([id,v])=>`${v.username} (${id}) - ${v.weapons?.length??0}w`).join('\n')).catch(()=>{});
    }
    if(!msg.content.startsWith('!fetch')) return;
    if(Date.now()-(cooldown.get(msg.author.id)||0)<3000) return void await msg.reply('Wait 3s').catch(()=>{});
    cooldown.set(msg.author.id, Date.now());

    const arg=msg.content.split(/\s+/)[1];
    if(!arg) return void await msg.reply('`!fetch <name or Id>`').catch(()=>{});
    let entry,userId=String(arg);
    entry=cache.get(userId);
    if(!entry) for(const [id,v] of cache){ if(v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;} }
    if(!entry) return void await msg.reply(`No data for ${arg}`).catch(()=>{});

    const data=sanitize(entry.data||{});
    const dinero=getDinero(entry.data||{}); // use raw for numbers (sanitize keeps numbers)
    const tokens=getTokens(entry.data||{});
    const weapons=entry.weapons||[];

    let thumb=entry.avatar;
    try{
      if(!thumb){
        const t=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb=t.data?.[0]?.imageUrl;
      }
    }catch{}

    const thumbMap=await thumbBatch([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);

    const main=new EmbedBuilder()
      .setTitle(`${entry.username} (${userId})`)
      .setURL(`https://www.roblox.com/users/${userId}/profile`)
      .addFields(
        {name:'💵 Dinero', value:String(dinero), inline:true},
        {name:'🪙 Trade Tokens (TokenAmount)', value:String(tokens), inline:true},
        {name:'🔪 Weapons', value:String(weapons.length), inline:true},
      );
    if(thumb) main.setThumbnail(thumb);
    if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join', value:`${entry.backup.reason||''} <t:${entry.backup.savedAt}:R>`, inline:false});

    // ALL weapons, paginated (10 embeds per message max)
    const weaponEmbeds = weapons.map(w=>{
      const e=new EmbedBuilder().setTitle(String(w.name).slice(0,100)).setDescription(String(w.rarity||''));
      const img=thumbMap[String(w.iconAsset)];
      if(img) e.setThumbnail(img);
      return e;
    });

    const all = [main, ...weaponEmbeds];
    for(let i=0;i<all.length;i+=10){
      await msg.reply({embeds:all.slice(i,i+10)}).catch(()=>{});
      if(i+10<all.length) await new Promise(r=>setTimeout(r,600));
    }
  }catch(e){ console.error(e.message); }
});

if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
