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
app.listen(process.env.PORT || 3000, () => {
  console.log(`Web server running on port ${process.env.PORT || 3000}`);
});

// ======================================================
// CONFIG
// ======================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ======================================================
// STAFF ROLES
// ======================================================
const STAFF_ROLES = ['YOUR_STAFF_ROLE_ID_HERE', 'YOUR_STAFF_ROLE_ID_HERE'];

// ======================================================
// AUTOMOD CONFIG
// ======================================================
const AUTOMOD_CONFIG = {
  inviteTimeoutMs: 5 * 60 * 1000,
  inviteTimeoutReason: 'Posted invite link',
  inviteEmbedColor: '#ff0000',
  blockedWordEmbedColor: '#ff0000',
  blockedWordDeleteMs: 3000
};

// ======================================================
// STORES
// ======================================================
const panelStore = {};   // For ticket panel data
const ticketCounts = {};

// ======================================================
// CLIENT
// ======================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
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
  .addStringOption(o => o.setName('panel_color').setDescription('Panel color (HEX)').setRequired(true))
  .addStringOption(o => o.setName('ticket_color').setDescription('Ticket embed color (HEX)').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Optional banner image URL').setRequired(false))

  // === CATEGORY 1 ===
  .addStringOption(o => o.setName('cat1_label').setDescription('Category 1 Label').setRequired(true))
  .addStringOption(o => o.setName('cat1_id').setDescription('Category Channel ID where tickets go').setRequired(true))
  .addStringOption(o => o.setName('cat1_emoji').setDescription('Emoji for Category 1').setRequired(false))
  .addStringOption(o => o.setName('cat1_prefix').setDescription('Channel prefix (e.g. content-creator)').setRequired(true))

  // === CATEGORY 2 ===
  .addStringOption(o => o.setName('cat2_label').setDescription('Category 2 Label').setRequired(true))
  .addStringOption(o => o.setName('cat2_id').setDescription('Category Channel ID where tickets go').setRequired(true))
  .addStringOption(o => o.setName('cat2_emoji').setDescription('Emoji for Category 2').setRequired(false))
  .addStringOption(o => o.setName('cat2_prefix').setDescription('Channel prefix').setRequired(true))

  // === CATEGORY 3 ===
  .addStringOption(o => o.setName('cat3_label').setDescription('Category 3 Label').setRequired(false))
  .addStringOption(o => o.setName('cat3_id').setDescription('Category Channel ID where tickets go').setRequired(false))
  .addStringOption(o => o.setName('cat3_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat3_prefix').setDescription('Channel prefix').setRequired(false))

  // === CATEGORY 4 ===
  .addStringOption(o => o.setName('cat4_label').setDescription('Category 4 Label').setRequired(false))
  .addStringOption(o => o.setName('cat4_id').setDescription('Category Channel ID where tickets go').setRequired(false))
  .addStringOption(o => o.setName('cat4_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat4_prefix').setDescription('Channel prefix').setRequired(false))

  // === CATEGORY 5 ===
  .addStringOption(o => o.setName('cat5_label').setDescription('Category 5 Label').setRequired(false))
  .addStringOption(o => o.setName('cat5_id').setDescription('Category Channel ID where tickets go').setRequired(false))
  .addStringOption(o => o.setName('cat5_emoji').setDescription('Emoji').setRequired(false))
  .addStringOption(o => o.setName('cat5_prefix').setDescription('Channel prefix').setRequired(false))

  // Add more if needed (up to Discord limit of 25 options)

const commands = [setticket.toJSON(), 
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket').toJSON(),
  new SlashCommandBuilder().setName('claim').setDescription('Claim this ticket').toJSON(),
  new SlashCommandBuilder().setName('add').setDescription('Add user to ticket').addUserOption(o => o.setName('user').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket').addUserOption(o => o.setName('user').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('rename').setDescription('Rename ticket').addStringOption(o => o.setName('name').setRequired(true)).toJSON()
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
// READY + STAFF CHECK
// ======================================================
client.once('ready', () => console.log(`${client.user.tag} is online`));

function isStaff(member) {
  return STAFF_ROLES.some(role => member.roles.cache.has(role));
}

// ======================================================
// INTERACTION HANDLER
// ======================================================
client.on('interactionCreate', async interaction => {
  // ====================== SETTICKET ======================
  if (interaction.isChatInputCommand() && interaction.commandName === 'setticket') {
    try {
      await interaction.deferReply({ ephemeral: true });

      const o = interaction.options;
      const panelTitle = o.getString('panel_title');
      const panelDesc = o.getString('panel_description');
      const panelColor = o.getString('panel_color');
      const ticketColor = o.getString('ticket_color');
      const panelImage = o.getString('panel_image');

      // Collect all categories
      const ticketOptions = [];
      for (let i = 1; i <= 5; i++) {  // You can increase this number
        const label = o.getString(`cat${i}_label`);
        if (!label) continue;

        ticketOptions.push({
          label: label,
          categoryId: o.getString(`cat${i}_id`),
          emoji: o.getString(`cat${i}_emoji`) || null,
          prefix: o.getString(`cat${i}_prefix`) || `ticket-${i}`
        });
      }

      if (ticketOptions.length === 0) {
        return interaction.editReply({ content: '❌ You must add at least one category.' });
      }

      // Build Embed
      const categoryList = ticketOptions.map(opt => 
        `${opt.emoji ? opt.emoji + ' ' : ''}**${opt.label}**`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(panelColor)
        .setTitle(panelTitle)
        .setDescription(panelDesc + `\n\n**📋 Available Categories:**\n${categoryList}`)
        .setFooter({ text: 'Select a category below to open a ticket' })
        .setTimestamp();

      if (panelImage?.startsWith('http')) embed.setImage(panelImage);

      // Dropdown Menu
      const menuId = `ticket_menu_${Date.now()}`;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Open a Ticket')
        .addOptions(ticketOptions.map((opt, i) => ({
          label: opt.label,
          value: String(i),
          emoji: opt.emoji
        })));

      const row1 = new ActionRowBuilder().addComponents(menu);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('edit_panel')
          .setLabel('Edit Panel')
          .setStyle(ButtonStyle.Secondary)
      );

      // Store data
      panelStore[menuId] = { ticketOptions, ticketColor };

      await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
      await interaction.editReply({ content: '✅ Ticket panel created successfully!' });

    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error creating panel.' }).catch(() => {});
    }
  }

  // ====================== TICKET CREATION ======================
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const panel = panelStore[interaction.customId];
      if (!panel) return interaction.editReply({ content: 'This panel is outdated. Please run /setticket again.' });

      const selected = panel.ticketOptions[parseInt(interaction.values[0])];
      if (!selected) return interaction.editReply({ content: 'Invalid selection.' });

      const { label, categoryId, prefix } = selected;

      if (!ticketCounts[categoryId]) ticketCounts[categoryId] = 1;
      else ticketCounts[categoryId]++;

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

      const ticketEmbed = new EmbedBuilder()
        .setColor(panel.ticketColor)
        .setTitle('New Support Ticket')
        .setDescription(`Welcome ${interaction.user}\n\nPlease explain your issue.`)
        .setFooter({ text: `Category: ${label}` })
        .setTimestamp();

      await channel.send({ content: `${interaction.user}`, embeds: [ticketEmbed], components: [buttons] });
      await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });

    } catch (err) {
      console.error(err);
      interaction.editReply({ content: 'Failed to create ticket.' }).catch(() => {});
    }
  }

  // Edit Panel Button
  if (interaction.isButton() && interaction.customId === 'edit_panel') {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'Only staff can edit the panel.', ephemeral: true });
    }
    await interaction.reply({ content: 'Just run `/setticket` again in this channel to update everything.', ephemeral: true });
  }

  // Close, Claim, Add, Remove, Rename commands + buttons (same as before)
  // ... (You can copy the rest from the previous version if you need them)
});

client.login(TOKEN);
