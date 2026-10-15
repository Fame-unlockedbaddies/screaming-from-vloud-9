console.log('>>> BOT FILE STARTED <<<');

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

console.log('TOKEN exists?', !!process.env.TOKEN);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on(Events.Error, (e) => console.error('Discord error:', e));

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.content === '!ping') await msg.reply('pong!');
});

if (!process.env.TOKEN) {
  console.error('❌ NO TOKEN - add TOKEN in Render > Environment');
} else {
  client.login(process.env.TOKEN).catch(e => console.error('❌ LOGIN FAILED:', e.message));
}
