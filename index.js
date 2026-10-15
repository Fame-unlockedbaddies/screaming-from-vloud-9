console.log('1 FILE LOADED');
try{
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
console.log('2 DISCORD.JS LOADED');
const express = require('express');
console.log('3 EXPRESS LOADED');

const app = express();
app.use(express.json({limit:'2mb'}));
app.get('/',(req,res)=>res.send('ok'));
const PORT = Number(process.env.PORT)||3000;
app.listen(PORT,'0.0.0.0',()=>console.log('4 WEB ON '+PORT));

const TOKEN=(process.env.TOKEN||'').trim();
console.log('5 TOKEN?',!!TOKEN,'len',TOKEN.length);
if(!TOKEN) console.error('❌ NO TOKEN ENV');

const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
console.log('6 CLIENT CREATED');
client.once(Events.ClientReady,()=>console.log(`✅ Logged in as ${client.user.tag}`));
client.on(Events.Error,e=>console.error(e.message));
console.log('7 LOGGING IN...');
if(TOKEN) client.login(TOKEN).then(()=>console.log('8 login() sent')).catch(e=>console.error('❌ LOGIN FAILED:',e.message));

client.on(Events.MessageCreate, async msg=>{
  if(msg.author.bot) return;
  if(msg.content==='!ping') msg.reply('pong!').catch(()=>{});
});
}catch(e){ console.error('❌ CRASH AT START:',e.message); }
