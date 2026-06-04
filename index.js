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

app.get('/', (req, res) => {
  res.send('Bot Online');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Web server running on port ${process.env.PORT || 3000}`);
});

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ======================================================
// STAFF ROLES
// ======================================================

const STAFF_ROLES = [
  '111111111111111111',
  '222222222222222222'
];

// ======================================================
// ROLES TO DM
// ======================================================

const NOTIFY_ROLES = [
  '1509385192853213184',
  '1482560426972549232',
  '1444833625362403381'
];

// ======================================================
// BLOCKED WORDS
// ======================================================

const BLOCKED_WORDS = [
  'playgrounds',
  'fame 2.0',
  'jay',
  'dm me'
];

// ======================================================
// HARDCODED TICKET OPTIONS
// label  - what shows in the dropdown
// emoji  - emoji shown next to label
// value  - categoryId|channelNamePrefix
//
// REPLACE THE CATEGORY IDs BELOW WITH YOUR OWN:
//   CATEGORY_CONTENT_CREATOR  → category for content creator apps
//   CATEGORY_REPORT_HACKER    → category for hacker reports
//   CATEGORY_CC_REWARDS       → category for CC reward claims
//   CATEGORY_BUG_REPORTS      → category for bug reports
//   CATEGORY_FEEDBACK         → category for feedback
//   CATEGORY_REPORT_STAFF     → category for staff reports
//   CATEGORY_REPORT_ADMIN     → category for admin reports
// ======================================================

const TICKET_OPTIONS = [
  {
    label: 'Apply for Content Creator',
    value: 'CATEGORY_CONTENT_CREATOR|content-creator'
  },
  {
    label: 'Report a Hacker',
    value: 'CATEGORY_REPORT_HACKER|report-hacker'
  },
  {
    label: 'CC Rewards',
    value: 'CATEGORY_CC_REWARDS|cc-rewards'
  },
  {
    label: 'Bug Reports',
    value: 'CATEGORY_BUG_REPORTS|bug-report'
  },
  {
    label: 'Feedback',
    value: 'CATEGORY_FEEDBACK|feedback'
  },
  {
    label: 'Report a Staff',
    value: 'CATEGORY_REPORT_STAFF|report-staff'
  },
  {
    label: 'Report an Admin',
    value: 'CATEGORY_REPORT_ADMIN|report-admin'
  }
];

// ======================================================
// PANEL CONFIG
// Customise the panel embed that appears in the channel
// ======================================================

const PANEL_CONFIG = {
  title: 'Support Tickets',
  description: 'Select a category below to open a ticket. Our staff will assist you as soon as possible.',
  color: '#5865F2',
  image: null // Set to a URL string to show a banner image, or leave null
};

// ======================================================
// TICKET EMBED CONFIG
// Customise the embed that appears inside each ticket
// ======================================================

const TICKET_CONFIG = {
  title: 'Support Ticket',
  description: 'Welcome {user}\n\nPlease explain your issue and wait for staff to respond.',
  color: '#2b2d31'
};

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
// TICKET COUNTS
// ======================================================

const ticketCounts = {};

// ======================================================
// COMMANDS
// ======================================================

const commands = [
  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Send the ticket panel to this channel')
    .toJSON()
];

// ======================================================
// REGISTER COMMANDS
// ======================================================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Commands Loaded');

  } catch (err) {

    console.log(err);

  }

})();

// ======================================================
// READY
// ======================================================

client.once('ready', () => {

  console.log(`${client.user.tag} Online`);

});

// ======================================================
// STAFF CHECK
// ======================================================

function isStaff(member) {

  return STAFF_ROLES.some(role =>
    member.roles.cache.has(role)
  );

}

// ======================================================
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.toLowerCase();

  // ====================================================
  // BLOCK INVITES
  // ====================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/') ||
    content.includes('discordapp.com/invite/')
  ) {

    await message.delete().catch(() => {});

    await message.member.timeout(
      5 * 60 * 1000,
      'Posted invite link'
    ).catch(() => {});

    await message.channel.send({

      embeds: [

        new EmbedBuilder()

          .setColor('#ff0000')

          .setDescription(
            `${message.author} invite links are not allowed.`
          )

      ]

    });

    for (const roleId of NOTIFY_ROLES) {

      const role =
        message.guild.roles.cache.get(roleId);

      if (!role) continue;

      for (const member of role.members.values()) {

        member.send({

          content:
            `The bot has timed out ${message.author}.`

        }).catch(() => {});

      }

    }

    return;

  }

  // ====================================================
  // BLOCK WORDS
  // ====================================================

  for (const word of BLOCKED_WORDS) {

    if (content.includes(word)) {

      await message.delete().catch(() => {});

      const warn =
        await message.channel.send({

          embeds: [

            new EmbedBuilder()

              .setColor('#ff0000')

              .setDescription(
                `${message.author} we do not use that word.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete().catch(() => {});

      }, 3000);

      return;

    }

  }

});

// ======================================================
// INTERACTIONS
// ======================================================

client.on('interactionCreate', async interaction => {

  // ====================================================
  // /SETTICKET
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'setticket'
  ) {

    try {

      await interaction.deferReply({ ephemeral: true });

      // ==================================================
      // BUILD PANEL EMBED
      // ==================================================

      const embed = new EmbedBuilder()

        .setColor(PANEL_CONFIG.color)

        .setTitle(PANEL_CONFIG.title)

        .setDescription(PANEL_CONFIG.description)

        .setFooter({ text: 'Select a category below' })

        .setTimestamp();

      if (
        PANEL_CONFIG.image &&
        (
          PANEL_CONFIG.image.startsWith('https://') ||
          PANEL_CONFIG.image.startsWith('http://')
        )
      ) {

        embed.setImage(PANEL_CONFIG.image);

      }

      // ==================================================
      // BUILD DROPDOWN MENU
      // ==================================================

      const menu = new StringSelectMenuBuilder()

        .setCustomId(`ticket_menu_${Date.now()}`)

        .setPlaceholder('Open a Ticket')

        .addOptions(
          TICKET_OPTIONS.map(opt => ({
            label: opt.label,
            value: opt.value
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);

      // ==================================================
      // SEND PANEL
      // ==================================================

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.editReply({ content: 'Ticket panel created.' });

    } catch (err) {

      console.log(err);

      if (!interaction.replied) {

        interaction.reply({
          content: 'Something went wrong.',
          ephemeral: true
        }).catch(() => {});

      }

    }

  }

  // ====================================================
  // CREATE TICKET (dropdown selected)
  // ====================================================

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith('ticket_menu_')) {

      try {

        await interaction.deferReply({ ephemeral: true });

        const data = interaction.values[0];
        const [categoryId, channelPrefix] = data.split('|');

        // Find the matching option for the label
        const selectedOption = TICKET_OPTIONS.find(
          opt => opt.value === data
        );

        const sectionLabel = selectedOption
          ? selectedOption.label
          : channelPrefix;

        // ==================================================
        // TICKET COUNT PER CATEGORY
        // ==================================================

        if (!ticketCounts[categoryId]) {
          ticketCounts[categoryId] = 1;
        } else {
          ticketCounts[categoryId]++;
        }

        const ticketNumber = ticketCounts[categoryId];

        // ==================================================
        // CREATE TICKET CHANNEL
        // ==================================================

        const channel = await interaction.guild.channels.create({

          name: `${channelPrefix}-${ticketNumber}`,

          type: ChannelType.GuildText,

          parent: categoryId,

          topic: interaction.user.id,

          permissionOverwrites: [

            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },

            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }

          ]

        });

        // ==================================================
        // TICKET BUTTONS
        // ==================================================

        const buttons = new ActionRowBuilder()

          .addComponents(

            new ButtonBuilder()
              .setCustomId('claim_ticket')
              .setLabel('Claim Ticket')
              .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)

          );

        // ==================================================
        // TICKET EMBED
        // ==================================================

        const ticketDescription = TICKET_CONFIG.description
          .replace('{user}', `${interaction.user}`);

        const embed = new EmbedBuilder()

          .setColor(TICKET_CONFIG.color)

          .setTitle(TICKET_CONFIG.title)

          .setDescription(ticketDescription)

          .setFooter({ text: `Category: ${sectionLabel}` })

          .setTimestamp();

        await channel.send({

          content: `${interaction.user}`,

          embeds: [embed],

          components: [buttons]

        });

        // ==================================================
        // REPLY TO USER
        // ==================================================

        await interaction.editReply({
          content: `Your ticket was created: ${channel}`
        });

      } catch (err) {

        console.log(err);

        if (!interaction.replied) {

          interaction.reply({
            content: 'Failed to create ticket.',
            ephemeral: true
          }).catch(() => {});

        }

      }

    }

  }

  // ====================================================
  // BUTTONS
  // ====================================================

  if (interaction.isButton()) {

    // ==================================================
    // CLAIM
    // ==================================================

    if (interaction.customId === 'claim_ticket') {

      if (!isStaff(interaction.member)) {

        return interaction.reply({
          content: 'Only staff can claim tickets.',
          ephemeral: true
        });

      }

      await interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor('#00ff00')

            .setDescription(
              `${interaction.user} claimed this ticket.`
            )

        ]

      });

    }

    // ==================================================
    // CLOSE
    // ==================================================

    if (interaction.customId === 'close_ticket') {

      const ownerId = interaction.channel.topic;
      const isOwner = interaction.user.id === ownerId;
      const staff = isStaff(interaction.member);

      if (!isOwner && !staff) {

        return interaction.reply({
          content: 'Only the ticket owner or staff can close this ticket.',
          ephemeral: true
        });

      }

      await interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor('#ff0000')

            .setDescription('Ticket closing in 5 seconds.')

        ]

      });

      setTimeout(async () => {

        await interaction.channel.delete().catch(() => {});

      }, 5000);

    }

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
