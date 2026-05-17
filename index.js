// ======================================================
// SIMPLE AUTOMOD BOT
// BLOCKS:
// - DISCORD INVITE LINKS
// - PROMOTIONAL LINKS
// - WORD "playgrounds"
// ======================================================

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require('discord.js');

const express = require('express');
require('dotenv').config();

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ======================================================
// READY
// ======================================================

client.once('ready', () => {

  console.log(`${client.user.tag} Online`);

});

// ======================================================
// MESSAGE FILTER
// ======================================================

client.on('messageCreate', async message => {

  // IGNORE BOTS

  if (message.author.bot) return;

  // IGNORE DMS

  if (!message.guild) return;

  // ALLOW ADMINS

  if (
    message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) return;

  const content =
    message.content.toLowerCase();

  // ======================================================
  // BLOCK INVITE LINKS
  // ======================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/')
  ) {

    // DELETE MESSAGE INSTANTLY

    await message.delete().catch(() => {});

    // SEND WARNING MESSAGE

    const warning =
      await message.channel.send({
        content:
          `${message.author} 😡 Invite links or any promotional links are not allowed.`
      });

    // DELETE WARNING AFTER 3 SECONDS

    setTimeout(async () => {

      warning.delete().catch(() => {});

    }, 3000);

    return;

  }

  // ======================================================
  // BLOCK WORD "playgrounds"
  // ======================================================

  if (
    content.includes('playgrounds')
  ) {

    // DELETE MESSAGE

    await message.delete().catch(() => {});

    // SEND WARNING MESSAGE

    const warning =
      await message.channel.send({
        content:
          `${message.author} 😡 The word "playgrounds" is not allowed here.`
      });

    // DELETE WARNING AFTER 3 SECONDS

    setTimeout(async () => {

      warning.delete().catch(() => {});

    }, 3000);

    return;

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(process.env.TOKEN);
