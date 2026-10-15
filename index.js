console.log('>>> BOOT <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({limit:'2mb'}));
app.get('/',(req,res)=>res.send('ok'));
const PORT = Number(process.env.PORT)||3000;
app.listen(PORT,'0.0.0.0',()=>console.log('WEB ON '+PORT));

const TOKEN=(process.env.TOKEN||'').trim();
const SECRET=process.env.ROBLOX_SECRET;
const WEBHOOK_URL=process.env.WEBHOOK_URL||'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';
const BANNER_URL='https://static.wikia.nocookie.net/marvel-rivals/images/4/44/Phoenix_Force_Rivals.png/revision/latest?cb=20250705000055';
const GIF_URL='https://i.pinimg.com/originals/7d/6e/8a/7d6e8ae0eb5450aaa3863a4e7cf469fb.gif';
const ORANGE=0xFF7A00;

const cache=new Map();
const cooldown=new Map();
const IGNORE=['punches','punch','spray','wallet','fists'];

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});

// NEVER REMOVED - always prints your bot name
client.once(Events.ClientReady,()=>{
  console.log(`✅ Logged in as ${client.user.tag}`);
});

async function getAvatars(userId){
  let head=null, full=null;
  try{
    const [h,f]=await Promise.all([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`).then(r=>r.json()).catch(()=>null),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png`).then(r=>r.json()).catch(()=>null),
    ]);
    head=h?.data?.[0]?.imageUrl||null; full=f?.data?.[0]?.imageUrl||null;
  }catch{}
  return {head,full};
}
async function thumbBatch(ids){
  const m={};
  for(let i=0;i<ids.length;i+=40){
    try{
      const r=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i,i+40).join(',')}&size=150x150&format=Png`).then(r=>r.json());
      for(const d of (r.data||[])) if(d.imageUrl) m[String(d.targetId)]=d.imageUrl;
    }catch{}
  }
  return m;
}
function wImg(w,map){
  if(w.iconAsset&&map[String(w.iconAsset)]) return map[String(w.iconAsset)];
  if(w.iconAsset) return `https://www.roblox.com/asset-thumbnail/image?assetId=${w.iconAsset}&width=150&height=150&format=png`;
  return null;
}

app.post('/roblox-data',(req,res)=>{
  if(req.headers['x-roblox-secret']!==SECRET) return res.status(401).send('bad');
  const {userId,username,avatar,data,backup,weapons}=req.body||{};
  if(!userId||!data) return res.status(400).send('missing');
  const cleanW=(weapons||[]).filter(w=>!IGNORE.some(i=>String(w.name||'').toLowerCase().includes(i))).slice(0,100);
  const isNew=!cache.has(String(userId));
  cache.set(String(userId),{username,avatar,data,backup,weapons:cleanW,updatedAt:Date.now()});
  if(isNew) fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Phoenix Cloud',embeds:[{title:`🔥 ${username} (${userId})`,color:ORANGE,thumbnail:{url:GIF_URL},image:{url:BANNER_URL},fields:[{name:'💵 Dinero',value:String(data.Money??0),inline:true},{name:'🪙 Tokens',value:String(data.NewInventory?.Tokens??0),inline:true},{name:'🔪 Weapons',value:String(cleanW.length),inline:true}]}]})}).catch(()=>{});
  res.send('ok');
});

client.on(Events.MessageCreate, async msg=>{
  if(msg.author.bot) return;
  if(msg.content==='!ping') return void await msg.reply('pong!').catch(()=>{});
  if(!msg.content.startsWith('!fetch')) return;
  if(Date.now()-(cooldown.get(msg.author.id)||0)<3000) return;
  cooldown.set(msg.author.id,Date.now());
  const arg=msg.content.split(/\s+/)[1];
  if(!arg) return void await msg.reply('`!fetch <name>`').catch(()=>{});
  let entry,userId=String(arg);
  entry=cache.get(userId);
  if(!entry) for(const [id,v] of cache) if(v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;}
  if(!entry) return void await msg.reply('No data').catch(()=>{});
  const {head,full}=await getAvatars(userId);
  const avatarHead=entry.avatar||head, avatarFull=full||head;
  const dinero=entry.data.Money??0, tokens=entry.data.NewInventory?.Tokens??0;
  const weapons=entry.weapons||[];
  const thumbMap=await thumbBatch([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);
  const main=new EmbedBuilder().setColor(ORANGE)
    .setAuthor({name:`${entry.username} • ${userId}`,iconURL:avatarHead||undefined,url:`https://www.roblox.com/users/${userId}/profile`})
    .setTitle(`🔥 ${entry.username}'s Profile`)
    .setThumbnail(GIF_URL).setImage(avatarFull||BANNER_URL)
    .addFields({name:'💵 Dinero',value:`**${Number(dinero).toLocaleString()}**`,inline:true},{name:'🪙 Trade Tokens',value:`**${Number(tokens).toLocaleString()}**`,inline:true},{name:'🔪 Weapons',value:`**${weapons.length}**`,inline:true})
    .setTimestamp(new Date(entry.updatedAt)).setFooter({text:`${client.user?.username||'Phoenix'} • Backup Cloud`});
  if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join',value:`<t:${entry.backup.savedAt}:R>`,inline:false});
  if(!weapons.length) return void await msg.reply({embeds:[main]}).catch(()=>{});
  const perPage=6,total=Math.ceil(weapons.length/perPage);
  let page=0;
  const makePage=(p)=>{
    const slice=weapons.slice(p*perPage,p*perPage+perPage);
    const e=new EmbedBuilder().setColor(ORANGE).setTitle(`🔪 Weapons • ${p+1}/${total}`).setThumbnail(GIF_URL).setImage(BANNER_URL);
    for(const w of slice){
      const img=wImg(w,thumbMap);
      e.addFields({name:`⚔️ ${w.name}`,value:`✨ ${w.rarity||''}${img?`\n[icon](${img})`:''}`,inline:true});
    }
    while(e.data.fields.length%3!==0) e.addFields({name:'\u200b',value:'\u200b',inline:true});
    e.setFooter({text:`◀ ▶ flip • ${weapons.length} total`});
    return e;
  };
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary));
  const reply=await msg.reply({embeds:[main,makePage(page)],components:total>1?[row]:[]}).catch(()=>null);
  if(!reply||total<=1) return;
  const col=reply.createMessageComponentCollector({time:120000});
  col.on('collect',async i=>{
    if(i.user.id!==msg.author.id) return void await i.reply({content:'Only you',ephemeral:true}).catch(()=>{});
    if(i.customId==='prev') page=(page-1+total)%total; else page=(page+1)%total;
    await i.update({embeds:[main,makePage(page)],components:[row]}).catch(()=>{});
  });
});

console.log('>>> LOGGING IN <<<');
if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
