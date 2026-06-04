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
const GUILD_ID = process.env.GUILD_ID;

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
// TICKET OPTIONS
//
// label      - text shown in the dropdown
// emoji      - emoji shown next to the label in the dropdown
//              use a unicode emoji e.g. 'star'
//              or a custom server emoji e.g. '<:name:id>'
//              set to null for no emoji
// categoryId - REPLACE with your Discord category ID
//              right-click a category > Copy ID
// prefix     - channel name prefix e.g. "content-creator-1"
// ======================================================

const TICKET_OPTIONS = [
  {
    label: 'Apply for Content Creator',
    emoji: null,                          // e.g. '<:cc:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // content creator category
    prefix: 'content-creator'
  },
  {
    label: 'Report a Hacker',
    emoji: null,                          // e.g. '<:hacker:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // hacker reports category
    prefix: 'report-hacker'
  },
  {
    label: 'CC Rewards',
    emoji: null,                          // e.g. '<:reward:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // cc rewards category
    prefix: 'cc-rewards'
  },
  {
    label: 'Bug Reports',
    emoji: null,                          // e.g. '<:bug:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // bug reports category
    prefix: 'bug-report'
  },
  {
    label: 'Feedback',
    emoji: null,                          // e.g. '<:feedback:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // feedback category
    prefix: 'feedback'
  },
  {
    label: 'Report a Staff',
    emoji: null,                          // e.g. '<:staff:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // report staff category
    prefix: 'report-staff'
  },
  {
    label: 'Report an Admin',
    emoji: null,                          // e.g. '<:admin:1234567890>'
    categoryId: 'YOUR_CATEGORY_ID_HERE', // report admin category
    prefix: 'report-admin'
  }
];

// ======================================================
// PANEL CONFIG
// The embed posted in the channel when you run /setticket
// ======================================================

const PANEL_CONFIG = {
  title: 'Support Tickets',
  description: 'Select a category below to open a ticket. Our staff will assist you as soon as possible.',
  color: '#5865F2',  // change to any HEX colour
  image: null        // set to an image URL or leave null
};

// ======================================================
// TICKET EMBED CONFIG
// The embed posted inside each opened ticket channel
// ======================================================

const TICKET_CONFIG = {
  title: 'Support Ticket',
  description: 'Welcome {user}\n\nPlease explain your issue and wait for staff to respond.',
  color: '#2b2d31'   // change to any HEX colour
};

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
// REGISTER COMMANDS — GUILD SCOPED (instant updates)
// ======================================================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Commands Loaded (guild)');

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
      AUTOMOD_CONFIG.inviteTimeoutMs,
      AUTOMOD_CONFIG.inviteTimeoutReason
    ).catch(() => {});

    await message.channel.send({

      embeds: [

        new EmbedBuilder()

          .setColor(AUTOMOD_CONFIG.inviteEmbedColor)

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
            `The bot has timed out ${message.author} for posting an invite link.`

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

              .setColor(AUTOMOD_CONFIG.blockedWordEmbedColor)

              .setDescription(
                `${message.author} we do not use that word.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete().catch(() => {});

      }, AUTOMOD_CONFIG.blockedWordDeleteMs);

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

      const menuOptions = TICKET_OPTIONS.map((opt, index) => {

        const option = {
          label: opt.label,
          value: String(index)
        };

        if (opt.emoji) {
          option.emoji = opt.emoji;
        }

        return option;

      });

      const menu = new StringSelectMenuBuilder()

        .setCustomId(`ticket_menu_${Date.now()}`)

        .setPlaceholder('Open a Ticket')

        .addOptions(menuOptions);

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

        const optionIndex = parseInt(interaction.values[0]);
        const selected = TICKET_OPTIONS[optionIndex];

        if (!selected) {

          return interaction.editReply({
            content: 'Invalid ticket option.'
          });

        }

        const { label, categoryId, prefix } = selected;

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

          name: `${prefix}-${ticketNumber}`,

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

          .setFooter({ text: `Category: ${label}` })

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
