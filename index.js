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
const BANNER_URL=process.env.BANNER_URL||'PUT_YOUR_PHOENIX_LINK_HERE'; // paste discord image link
const ORANGE=0xFF7A00;

const cache=new Map();
const cooldown=new Map();
const IGNORE=['punches','punch','spray','wallet','fists'];

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once(Events.ClientReady,()=>console.log(`✅ Logged in as ${client.user.tag}`));

function weaponImg(w,map){
  if(w.iconAsset&&map[String(w.iconAsset)]) return map[String(w.iconAsset)];
  if(w.iconAsset) return `https://www.roblox.com/asset-thumbnail/image?assetId=${w.iconAsset}&width=150&height=150&format=png`;
  return null;
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

app.post('/roblox-data',(req,res)=>{
  if(req.headers['x-roblox-secret']!==SECRET) return res.status(401).send('bad');
  const {userId,username,avatar,data,backup,weapons}=req.body||{};
  if(!userId||!data) return res.status(400).send('missing');
  const cleanW=(weapons||[]).filter(w=>!IGNORE.some(i=>String(w.name||'').toLowerCase().includes(i))).slice(0,100);
  const isNew=!cache.has(String(userId));
  cache.set(String(userId),{username,avatar,data,backup,weapons:cleanW,updatedAt:Date.now()});
  if(isNew) fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Backup Cloud',embeds:[{title:`☁️ ${username} (${userId})`,color:ORANGE,image:{url:BANNER_URL.startsWith('http')?BANNER_URL:undefined},fields:[{name:'💵 Dinero',value:String(data.Money??0),inline:true},{name:'🪙 Trade Tokens',value:String(data.NewInventory?.Tokens??0),inline:true},{name:'🔪 Weapons',value:String(cleanW.length),inline:true}]}]})}).catch(()=>{});
  res.send('ok');
});

function buildWeaponPage(weapons, thumbMap, page, perPage=5){
  const total=Math.max(1,Math.ceil(weapons.length/perPage));
  page=Math.min(Math.max(0,page),total-1);
  const slice=weapons.slice(page*perPage,page*perPage+perPage);
  const e=new EmbedBuilder().setColor(ORANGE).setTitle(`🔪 Weapons — Page ${page+1}/${total}`);
  if(BANNER_URL.startsWith('http')) e.setImage(BANNER_URL);
  if(!slice.length) e.setDescription('No weapons');
  for(const w of slice){
    const img=weaponImg(w,thumbMap);
    // row layout: name + rarity + icon link
    e.addFields({name:`${w.name}`, value:`${w.rarity||''}${img?` • [icon](${img})`:''}`, inline:true});
  }
  // pad to keep rows even (3 per row)
  while(e.data.fields && e.data.fields.length%3!==0) e.addFields({name:'\u200b',value:'\u200b',inline:true});
  e.setFooter({text:`◀ ▶ to flip • ${weapons.length} total`});
  return {embed:e,total,page};
}

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

  const dinero=entry.data.Money??0, tokens=entry.data.NewInventory?.Tokens??0;
  const weapons=entry.weapons||[];
  const thumbMap=await thumbBatch([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);
  let thumb=entry.avatar;
  try{
    if(!thumb){
      const t=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
      thumb=t.data?.[0]?.imageUrl;
    }
  }catch{}

  const main=new EmbedBuilder().setColor(ORANGE).setTitle(`${entry.username} (${userId})`).setURL(`https://www.roblox.com/users/${userId}/profile`)
    .addFields({name:'💵 Dinero',value:String(dinero),inline:true},{name:'🪙 Trade Tokens',value:String(tokens),inline:true},{name:'🔪 Weapons',value:String(weapons.length),inline:true});
  if(thumb) main.setThumbnail(thumb); // weapon icons go in pages below
  if(BANNER_URL.startsWith('http')) main.setImage(BANNER_URL);
  if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join',value:`<t:${entry.backup.savedAt}:R>`,inline:false});

  if(!weapons.length){
    return void await msg.reply({embeds:[main]}).catch(()=>{});
  }

  let page=0;
  const perPage=6; // 6 = 2 rows of 3
  let {embed,total}=buildWeaponPage(weapons,thumbMap,page,perPage);

  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary),
  );
  const reply=await msg.reply({embeds:[main,embed],components:total>1?[row]:[]}).catch(()=>null);
  if(!reply||total<=1) return;

  const col=reply.createMessageComponentCollector({time:120000});
  col.on('collect', async i=>{
    if(i.user.id!==msg.author.id) return void await i.reply({content:'Only command user',ephemeral:true}).catch(()=>{});
    if(i.customId==='prev') page=(page-1+total)%total;
    if(i.customId==='next') page=(page+1)%total;
    const b=buildWeaponPage(weapons,thumbMap,page,perPage);
    await i.update({embeds:[main,b.embed],components:[row]}).catch(()=>{});
  });
  col.on('end', async ()=>{ await reply.edit({components:[]}).catch(()=>{}); });
});

if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error(e.message));
