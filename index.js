const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// keeps Render Web Service alive (Render requires a port)
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('messageCreate', msg => {
  if (msg.content === '!ping') msg.reply('pong!');
});

client.login(process.env.TOKEN);
