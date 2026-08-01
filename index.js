const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events
} = require('discord.js');
const express = require('express');
require('dotenv').config();

// ===== Web server for Render =====
const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
// =================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // !ping
  if (message.content.toLowerCase() === '!ping') {
    await message.reply('Pong!');
  }

  // !info
  if (message.content.toLowerCase() === '!info') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Bot Info')
      .setDescription('Clean starter bot')
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
