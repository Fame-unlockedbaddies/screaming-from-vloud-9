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
  PermissionFlagsBits
} = require('discord.js');

const express = require('express');
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

// STAFF ROLES
const STAFF_ROLES = [
  '1505376743001821334',
  '1505379855137509538'
];

// STORES
const panelStore = {};
const ticketCounts = {};

// CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent]
});

// ======================================================
// COMMANDS
// ======================================================
const setticket = new SlashCommandBuilder()
  .setName('setticket')
  .setDescription('Send the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('panel_title').setDescription('Panel Title').setRequired(true))
  .addStringOption(o => o.setName('panel_description').setDescription('Panel Description').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Banner Image URL (optional)').setRequired(false));

const commands = [
  setticket.toJSON(),
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
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// READY
client.once('ready', () => console.log(`${client.user.tag} is online`));

function isStaff(member) {
  return STAFF_ROLES.some(role => member.roles.cache.has(role));
}

// ======================================================
// INTERACTIONS
// ======================================================
client.on('interactionCreate', async interaction => {

  if (interaction.isChatInputCommand() && interaction.commandName === 'setticket') {
    try {
      await interaction.deferReply({ ephemeral: true });
      const o = interaction.options;

      // BUILT-IN CATEGORIES - NO EMOJIS
      const ticketOptions = [
        { label: "Apply for Content Creator", categoryId: "1510798983344160889", prefix: "content-creator" },
        { label: "Report a Exploiter",       categoryId: "1510798973517172859", prefix: "report-exploiter" },
        { label: "CC Rewards",               categoryId: "1510798973517172859", prefix: "cc-rewards" },
        { label: "Report a Staff",           categoryId: "1512253003820699698", prefix: "report-staff" },
        { label: "Report a Admin",           categoryId: "1512253208872095795", prefix: "report-admin" }
      ];

      const categoryList = ticketOptions.map(opt => `**${opt.label}**`).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#c2ecff')
        .setTitle(o.getString('panel_title'))
        .setDescription(o.getString('panel_description') + `\n\n**Available Categories:**\n${categoryList}`)
        .setFooter({ text: 'Select a category below to open a ticket' })
        .setTimestamp();

      const image = o.getString('panel_image');
      if (image && image.startsWith('http')) embed.setImage(image);

      const menuId = `ticket_menu_${Date.now()}`;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Open a Ticket')
        .addOptions(ticketOptions.map((opt, i) => ({
          label: opt.label,
          value: i.toString()
        })));

      const row = new ActionRowBuilder().addComponents(menu);

      panelStore[menuId] = { ticketOptions, ticketColor: '#2b2d31' };

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: '✅ Ticket panel created successfully!' });

    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error creating panel.' }).catch(() => {});
    }
  }

  // CREATE TICKET
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const panel = panelStore[interaction.customId];
      if (!panel) return interaction.editReply({ content: 'This panel is outdated. Run /setticket again.' });

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

  // BUTTONS
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
