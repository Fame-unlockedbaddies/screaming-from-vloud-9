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
const STAFF_ROLES = ['YOUR_STAFF_ROLE_ID_HERE', 'YOUR_STAFF_ROLE_ID_HERE'];

// ======================================================
// STORES
// ======================================================
const panelStore = {};
const ticketCounts = {};

// ======================================================
// CLIENT
// ======================================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent]
});

// ======================================================
// COMMANDS
// ======================================================
const setticket = new SlashCommandBuilder()
  .setName('setticket')
  .setDescription('Create or edit the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

  // Panel Settings
  .addStringOption(o => o.setName('panel_title').setDescription('Panel title').setRequired(true))
  .addStringOption(o => o.setName('panel_description').setDescription('Panel description').setRequired(true))
  .addStringOption(o => o.setName('panel_color').setDescription('Panel color HEX').setRequired(true))
  .addStringOption(o => o.setName('ticket_color').setDescription('Ticket embed color HEX').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Optional banner image URL').setRequired(false))

  // Category 1 - Apply for Content Creator
  .addStringOption(o => o.setName('cat1_label').setDescription('Label for Apply for Content Creator').setRequired(false))
  .addStringOption(o => o.setName('cat1_id').setDescription('Category ID for tickets').setRequired(false))
  .addStringOption(o => o.setName('cat1_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat1_prefix').setDescription('Channel prefix').setRequired(false))

  // Category 2 - Report a Hacker
  .addStringOption(o => o.setName('cat2_label').setDescription('Label for Report a Hacker').setRequired(false))
  .addStringOption(o => o.setName('cat2_id').setDescription('Category ID for tickets').setRequired(false))
  .addStringOption(o => o.setName('cat2_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat2_prefix').setDescription('Channel prefix').setRequired(false))

  // Category 3 - CC Rewards
  .addStringOption(o => o.setName('cat3_label').setDescription('Label for CC Rewards').setRequired(false))
  .addStringOption(o => o.setName('cat3_id').setDescription('Category ID for tickets').setRequired(false))
  .addStringOption(o => o.setName('cat3_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat3_prefix').setDescription('Channel prefix').setRequired(false))

  // Category 4 - Report Staff
  .addStringOption(o => o.setName('cat4_label').setDescription('Label for Report Staff').setRequired(false))
  .addStringOption(o => o.setName('cat4_id').setDescription('Category ID for tickets').setRequired(false))
  .addStringOption(o => o.setName('cat4_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat4_prefix').setDescription('Channel prefix').setRequired(false))

  // Category 5 - Report Admin
  .addStringOption(o => o.setName('cat5_label').setDescription('Label for Report Admin').setRequired(false))
  .addStringOption(o => o.setName('cat5_id').setDescription('Category ID for tickets').setRequired(false))
  .addStringOption(o => o.setName('cat5_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat5_prefix').setDescription('Channel prefix').setRequired(false));

const commands = [
  setticket.toJSON(),
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket').toJSON(),
  new SlashCommandBuilder().setName('claim').setDescription('Claim this ticket').toJSON(),
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

// ======================================================
// READY
// ======================================================
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

      // Default categories
      const defaults = [
        { label: 'Apply for Content Creator', emoji: '🎥', prefix: 'content-creator' },
        { label: 'Report a Hacker', emoji: '🚨', prefix: 'report-hacker' },
        { label: 'CC Rewards', emoji: '🏆', prefix: 'cc-rewards' },
        { label: 'Report Staff', emoji: '📛', prefix: 'report-staff' },
        { label: 'Report Admin', emoji: '👑', prefix: 'report-admin' }
      ];

      const ticketOptions = [];

      for (let i = 1; i <= 5; i++) {
        const label = o.getString(`cat${i}_label`) || defaults[i-1].label;
        const categoryId = o.getString(`cat${i}_id`);
        
        if (!categoryId) continue; // Skip if no category ID provided

        ticketOptions.push({
          label,
          categoryId,
          emoji: o.getString(`cat${i}_emoji`) || defaults[i-1].emoji,
          prefix: o.getString(`cat${i}_prefix`) || defaults[i-1].prefix
        });
      }

      if (ticketOptions.length === 0) {
        return interaction.editReply({ content: '❌ You must provide at least one **Category ID**.' });
      }

      const categoryList = ticketOptions.map(opt => `${opt.emoji ? opt.emoji + ' ' : ''}**${opt.label}**`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(o.getString('panel_color'))
        .setTitle(o.getString('panel_title'))
        .setDescription(o.getString('panel_description') + `\n\n**Available Categories:**\n${categoryList}`)
        .setFooter({ text: 'Select a category below' })
        .setTimestamp();

      if (o.getString('panel_image')?.startsWith('http')) embed.setImage(o.getString('panel_image'));

      const menuId = `ticket_menu_${Date.now()}`;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Open a Ticket')
        .addOptions(ticketOptions.map((opt, i) => ({
          label: opt.label,
          value: i.toString(),
          emoji: opt.emoji
        })));

      const row1 = new ActionRowBuilder().addComponents(menu);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('edit_panel').setLabel('Edit Panel').setStyle(ButtonStyle.Secondary)
      );

      panelStore[menuId] = { ticketOptions, ticketColor: o.getString('ticket_color') };

      await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
      await interaction.editReply({ content: '✅ Ticket panel created/updated successfully!' });

    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error creating panel.' }).catch(() => {});
    }
  }

  // Ticket Creation
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const panel = panelStore[interaction.customId];
      if (!panel) return interaction.editReply({ content: 'Panel outdated. Run /setticket again.' });

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
          .setTimestamp()
        ],
        components: [buttons]
      });

      await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: 'Failed to create ticket.' }).catch(() => {});
    }
  }

  // Edit Button
  if (interaction.isButton() && interaction.customId === 'edit_panel') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Only staff can edit.', ephemeral: true });
    await interaction.reply({ content: 'Run `/setticket` again to edit categories, emojis, etc.', ephemeral: true });
  }

  // Close & Claim buttons
  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket' || interaction.commandName === 'close') {
      const ownerId = interaction.channel?.topic;
      const isOwner = interaction.user.id === ownerId;
      const staff = isStaff(interaction.member);
      if (!isOwner && !staff) return interaction.reply({ content: 'Only owner or staff can close.', ephemeral: true });

      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('Ticket closing in 5 seconds.')] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    if (interaction.customId === 'claim_ticket' || interaction.commandName === 'claim') {
      if (!isStaff(interaction.member)) return interaction.reply({ content: 'Only staff.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription(`${interaction.user} claimed this ticket.`)] });
    }
  }
});

client.login(TOKEN);
