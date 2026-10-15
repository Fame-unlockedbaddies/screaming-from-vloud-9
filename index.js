console.log('>>> BOOT <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({limit:'2mb'}));

// PINGER endpoints - must be fast
app.get('/', (req,res)=>res.status(200).send('Bot online!'));
app.get('/health', (req,res)=>res.status(200).json({up:true, cache:cache.size}));
app.get('/ping', (req,res)=>res.status(200).send('pong'));

const PORT = Number(process.env.PORT)||3000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://screaming-from-vloud-9.onrender.com';
app.listen(PORT,'0.0.0.0',()=>{
  console.log('WEB ON '+PORT);
  // self-ping every 4m as backup to UptimeRobot
  setInterval(()=>{
    fetch(SELF_URL+'/health').then(()=>console.log('self-ping ok')).catch(()=>{});
  }, 4*60*1000);
});

const TOKEN=(process.env.TOKEN||'').trim();
const SECRET=process.env.ROBLOX_SECRET;
const WEBHOOK_URL=process.env.WEBHOOK_URL||'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';
const BANNER_URL='https://static.wikia.nocookie.net/marvel-rivals/images/4/44/Phoenix_Force_Rivals.png/revision/latest?cb=20250705000055';
const GIF_URL='https://i.pinimg.com/originals/7d/6e/8a/7d6e8ae0eb5450aaa3863a4e7cf469fb.gif';
const ORANGE=0xFF7A00;

const WEAPONS_ICONS={"stopsignal":"17724939918","toilet":"7344738286","trashbag":"17724935502","Dagger":"136254033056151","Loveboard":"18208773981","Flamethrower":"17729420263","GoldenStopSign":"18199671086","Golden Sledgehammer":"18199671086","Sledgehammer":"128257569042086","Sledge Hammer":"128257569042086","GoldenPipe":"18199672855","RPG":"17724938259","Gas Mask":"131972692672543","Gas Bomb":"72714495178494","Snowball Launcher":"71364687241971","Golden Snowball Launcher":"110062290771533","SpikedPurse":"18198635722","Dog Leash":"18895444353","Hanger":"120744935763387","Baddie Mask":"71183982504920","Glitter Bomb":"127998959033560","Spiked Kitty Stanli":"128112471659428","TurkeySkewers":"100312172464534","Sakura Blade":"111639380397731","Pan":"85547938260049","Yardstick":"119109721012087","Textbook":"96603367489239","Brass Knuckles":"122336505596550","RiotShield":"75337258382093","BeachShovel":"90865961854855","Fan of Requiem":"81282983811798","Spiked Knuckles":"105761940402851","Kitty Purse":"18560510870","Spiked Nightmare Purse":"126124408405738","Shiny Purse":"18561466519","Chain Mace":"92157181856760","Crowbar":"92362406030483","Champion Gloves":"88293139610302","Nunchucks":"98918963282426","Cupids Bow":"124821495846898","Golden Flamethrower":"136548897879669","Golden RPG":"94045965088486","Golden Taser":"113420120306640","PinkStopSignal":"17824902074","SpikedBaseballBat":"18364041365","DogPurse":"122179397547689","Chainsaw":"131772201723334","Handcuffs":"85213537454139","Boxing Gloves":"85213537454139","Harpoon":"102024070787005","Trashbin Disguise":"90341841578510","Freeze Gun":"71864495855399","Lunch Tray":"139419273569383","Spatula":"91764156477198","Chocolate Milk":"107572634767993","Scythe":"130765913787347","Trident":"117058605304202","Cannon":"79533370612265","Slasher Claws":"111926038012106","Grim Reaper Cloak":"112579335646597","Stick":"118634164656896","Spearhead Stick":"115902649906441","Slingshot":"98909104474571","Rusty Bow":"104887933125876","Regular Bow":"93849279274928","Blast Bow":"104012711698142","Golden Knuckles":"98677453897467","Golden Sakura Blade":"107185542990184","Roller Skates":"100849832982887","Witch Scepter":"124512130942721","Witch Wand":"118775888730320","Ghostly Gloves":"128578502145828","Axe":"73680117560786","Parasol":"121518284878347","Santa's Naughty or Nice Launcher":"108427592647631","Ice Crown Queen":"101893568508166","Reindeer Purse":"124493777120672","Grenade Launcher":"133258186563644","Bewitched Chaos":"133258186563644","Dance Bomb":"87763934711205","Chakram":"71549061483249","Inferno Blade":"124875961709695","Golden Cupids Bow":"79876088386663","Firework Gun":"110844715179353","Glitter Blue Spray":"112782528233059","Gravity Gun":"107505773665016","Grapple Hook":"127598464410935","Ice Katana":"96219364808568","Love Me Hate Me Taser":"110291208425188","Medic Spray":"84843134989169","Golden Nunchucks":"94625624597477","Poison Knuckles":"129992151534039","Twin Blade":"115605425801679","Text Sign":"135049278951789","Bunny Shoes":"112325940183206","Vine Bomb":"75690753643077","Sakura Sword and Shield Set":"131891873343753","Water Fan":"104388587665269","Yin Yang Knives":"74690350427146","Spa Slippers":"88244907752354","Towel Whip":"138737990393924","Katana & Kunai Set":"81475251525721","Golden Scythe":"72369454764748","Wingblades":"82851163041641","Tidal Fists":"78896456775321","Rainbow Portal Gun":"124135637245739","Water Balloon Gun":"114306142483850","Spear":"97411896340236","Toothbrush Shiv":"139220638507687","Sock with Rocks":"84756816343627","Kiss Kiss":"103871716868187","Golden Chainsaw":"104878733520034","Electric Love Baton":"82794938777869","Ribbon Dancer":"116986901396454","Dual Sais":"125110054091819","Apex Shield":"117612855042286","Apex Blade":"135733140799200","Spiked Boots":"139030224720289","Siphon Scythe":"121760141052290","Golden Poison Knuckles":"81436666409683","Trick or Treat RPG":"83712186787206"};

const cache=new Map();
const cooldown=new Map();
const IGNORE=['punches','punch','spray','wallet','fists'];

// keep login log
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once(Events.ClientReady,()=>{ console.log(`✅ Logged in as ${client.user.tag}`); });
client.on(Events.ShardDisconnect,()=>console.log('shard dc - will auto reconnect'));
client.on(Events.Error,e=>console.error(e.message));

function getIconId(w){
  if(w.iconAsset) return String(w.iconAsset);
  if(WEAPONS_ICONS[w.name]) return WEAPONS_ICONS[w.name];
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
async function getAvatars(userId){
  try{
    const [h,f]=await Promise.all([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`).then(r=>r.json()).catch(()=>null),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png`).then(r=>r.json()).catch(()=>null),
    ]);
    return {head:h?.data?.[0]?.imageUrl||null, full:f?.data?.[0]?.imageUrl||null};
  }catch{ return {head:null,full:null}; }
}

app.post('/roblox-data',(req,res)=>{
  try{
    if(req.headers['x-roblox-secret']!==SECRET) return res.status(401).send('bad');
    const {userId,username,avatar,data,backup,weapons}=req.body||{};
    if(!userId||!data) return res.status(400).send('missing');
    const cleanW=(weapons||[]).filter(w=>!IGNORE.some(i=>String(w.name||'').toLowerCase().includes(i))).slice(0,100);
    for(const w of cleanW){ if(!w.iconAsset){ const id=getIconId(w); if(id) w.iconAsset=id; } }
    const isNew=!cache.has(String(userId));
    cache.set(String(userId),{username,avatar,data,backup,weapons:cleanW,updatedAt:Date.now()});
    if(isNew) fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Phoenix Cloud',embeds:[{title:`${username} (${userId})`,color:ORANGE,thumbnail:{url:GIF_URL},image:{url:BANNER_URL},fields:[{name:'Dinero',value:String(data.Money??0),inline:true},{name:'Trade Tokens',value:String(data.NewInventory?.Tokens??0),inline:true},{name:'Weapons',value:String(cleanW.length),inline:true}]}]})}).catch(()=>{});
    res.send('ok');
  }catch{ res.status(500).send('err'); }
});

client.on(Events.MessageCreate, async msg=>{
  try{
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
    const thumbMap=await thumbBatch([...new Set(weapons.map(getIconId).filter(Boolean))]);
    const main=new EmbedBuilder().setColor(ORANGE)
      .setAuthor({name:`${entry.username} • ${userId}`,iconURL:avatarHead||undefined,url:`https://www.roblox.com/users/${userId}/profile`})
      .setTitle(`${entry.username}'s Profile`)
      .setThumbnail(avatarHead||GIF_URL).setImage(avatarFull||BANNER_URL)
      .addFields({name:'Dinero',value:`**${Number(dinero).toLocaleString()}**`,inline:true},{name:'Trade Tokens',value:`**${Number(tokens).toLocaleString()}**`,inline:true},{name:'Weapons',value:`**${weapons.length}**`,inline:true})
      .setTimestamp(new Date(entry.updatedAt)).setFooter({text:`${client.user?.username||'Phoenix'} • Backup Cloud`});
    if(entry.backup?.savedAt) main.addFields({name:'Backup First-Join',value:`<t:${entry.backup.savedAt}:R>`,inline:false});
    if(!weapons.length) return void await msg.reply({embeds:[main]}).catch(()=>{});
    const perPage=6,total=Math.ceil(weapons.length/perPage);
    let page=0;
    const makePage=(p)=>{
      const slice=weapons.slice(p*perPage,p*perPage+perPage);
      const e=new EmbedBuilder().setColor(ORANGE).setTitle(`Weapons • ${p+1}/${total}`).setThumbnail(GIF_URL).setImage(BANNER_URL);
      for(const w of slice){
        const id=getIconId(w);
        const img=id?(thumbMap[id]||`https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`):null;
        e.addFields({name:`${w.name}`,value:`${w.rarity||''}`,inline:true});
        if(img) e.addFields({name:'\u200b',value:`[icon](${img})`,inline:true});
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
  }catch(e){ console.error(e.message); }
});

// never crash on network blips - critical for 24/7
process.on('unhandledRejection',e=>console.error('unhandled',e?.message));
process.on('uncaughtException',e=>console.error('uncaught',e?.message));

console.log('>>> LOGGING IN <<<');
if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
