console.log('>>> BOOT <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({limit:'2mb'}));
app.get('/',(req,res)=>res.send('Bot online!'));
app.get('/health',(req,res)=>res.send('ok'));
const PORT = Number(process.env.PORT)||3000;
app.listen(PORT,'0.0.0.0',()=>console.log('WEB ON '+PORT));

const TOKEN=(process.env.TOKEN||'').trim();
const SECRET=process.env.ROBLOX_SECRET;
const WEBHOOK_URL=process.env.WEBHOOK_URL||'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';
const BANNER_URL='https://static.wikia.nocookie.net/marvel-rivals/images/4/44/Phoenix_Force_Rivals.png/revision/latest?cb=20250705000055';
const GIF_URL='https://i.pinimg.com/originals/7d/6e/8a/7d6e8ae0eb5450aaa3863a4e7cf469fb.gif';
const ORANGE=0xFF7A00;
const cache=new Map();

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});

// LOGGED IN MESSAGE - never remove
client.once(Events.ClientReady,()=>{
  console.log(`✅ Logged in as ${client.user.tag}`);
});

app.post('/roblox-data',(req,res)=>{
  if(req.headers['x-roblox-secret']!==SECRET) return res.status(401).send('bad');
  const {userId,username,avatar,data,backup,weapons}=req.body||{};
  if(!userId||!data) return res.status(400).send('missing');
  cache.set(String(userId),{username,avatar,data,backup,weapons:weapons||[],updatedAt:Date.now()});
  res.send('ok');
});

client.on(Events.MessageCreate, async msg=>{
  if(msg.author.bot) return;
  if(msg.content==='!ping') msg.reply('pong!');
  if(msg.content.startsWith('!fetch')){
    const arg=msg.content.split(' ')[1];
    const e=cache.get(String(arg))||[...cache.values()].find(v=>v.username?.toLowerCase()===String(arg).toLowerCase());
    if(!e) return void msg.reply('No data').catch(()=>{});
    const embed=new EmbedBuilder().setColor(ORANGE).setTitle(`${e.username}`).setThumbnail(e.avatar||GIF_URL).setImage(BANNER_URL)
      .addFields({name:'Dinero',value:String(e.data.Money??0),inline:true},{name:'Trade Tokens',value:String(e.data.NewInventory?.Tokens??0),inline:true},{name:'Weapons',value:String(e.weapons.length),inline:true});
    msg.reply({embeds:[embed]}).catch(()=>{});
  }
});

console.log('>>> LOGGING IN <<<');
client.login(TOKEN).then(()=>console.log('login sent, waiting Ready...')).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
