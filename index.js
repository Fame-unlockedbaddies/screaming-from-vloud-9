console.log('BOOT TEST');
const { Client, GatewayIntentBits, Events } = require('discord.js');
console.log('TOKEN?', !!process.env.TOKEN, 'len', (process.env.TOKEN||'').length);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.once(Events.ClientReady, ()=>console.log(`✅ Logged in as ${client.user.tag}`));
client.login(process.env.TOKEN).then(()=>console.log('login call ok')).catch(e=>console.error('❌ LOGIN FAILED:', e.message));
