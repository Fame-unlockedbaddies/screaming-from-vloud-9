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
// TICKET COUNT
// ======================================================

let ticketCount = 0;

// ======================================================
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()

    .setName('setticket')

    .setDescription('Create a custom ticket panel')

    // ==================================================
    // REQUIRED OPTIONS
    // ==================================================

    .addStringOption(option =>
      option
        .setName('panel_title')
        .setDescription('Panel title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('panel_description')
        .setDescription('Panel description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('panel_color')
        .setDescription('Panel HEX color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_title')
        .setDescription('Ticket title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_description')
        .setDescription('Ticket description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_color')
        .setDescription('Ticket HEX color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('section1')
        .setDescription('Section 1')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('emoji1')
        .setDescription('Emoji 1')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('category1')
        .setDescription('Category ID 1')
        .setRequired(true)
    )

    // ==================================================
    // OPTIONAL OPTIONS
    // ==================================================

    .addStringOption(option =>
      option
        .setName('panel_image')
        .setDescription('Banner image URL')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section2')
        .setDescription('Section 2')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji2')
        .setDescription('Emoji 2')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category2')
        .setDescription('Category ID 2')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section3')
        .setDescription('Section 3')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji3')
        .setDescription('Emoji 3')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category3')
        .setDescription('Category ID 3')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section4')
        .setDescription('Section 4')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji4')
        .setDescription('Emoji 4')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category4')
        .setDescription('Category ID 4')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section5')
        .setDescription('Section 5')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji5')
        .setDescription('Emoji 5')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category5')
        .setDescription('Category ID 5')
        .setRequired(false)
    )

].map(command => command.toJSON());

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

    // ==================================================
    // TIMEOUT USER
    // ==================================================

    await message.member.timeout(

      10 * 60 * 1000,
      'Posted invite link'

    ).catch(() => {});

    // ==================================================
    // WARNING MESSAGE
    // ==================================================

    await message.channel.send({

      embeds: [

        new EmbedBuilder()

          .setColor('#ff0000')

          .setDescription(
            `${message.author} invite links are not allowed.`
          )

      ]

    });

    // ==================================================
    // DM STAFF ROLES
    // ==================================================

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

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'setticket') {

      const panelTitle =
        interaction.options.getString('panel_title');

      const panelDescription =
        interaction.options.getString('panel_description');

      const panelColor =
        interaction.options.getString('panel_color');

      const panelImage =
        interaction.options.getString('panel_image');

      const ticketTitle =
        interaction.options.getString('ticket_title');

      const ticketDescription =
        interaction.options.getString('ticket_description');

      const ticketColor =
        interaction.options.getString('ticket_color');

      const options = [];

      for (let i = 1; i <= 5; i++) {

        const section =
          interaction.options.getString(`section${i}`);

        const emoji =
          interaction.options.getString(`emoji${i}`);

        const category =
          interaction.options.getString(`category${i}`);

        if (
          section &&
          emoji &&
          category
        ) {

          options.push({

            label: section,

            emoji: emoji,

            value:
              `${category}|${section}|${ticketTitle}|${ticketDescription}|${ticketColor}`

          });

        }

      }

      // ==================================================
      // PANEL EMBED
      // ==================================================

      const embed =
        new EmbedBuilder()

          .setColor(panelColor)

          .setTitle(panelTitle)

          .setDescription(panelDescription)

          .setFooter({

            text:
              'Select a category below'

          })

          .setTimestamp();

      // ==================================================
      // PANEL IMAGE
      // ==================================================

      if (
        panelImage &&
        (
          panelImage.startsWith('https://') ||
          panelImage.startsWith('http://')
        )
      ) {

        embed.setImage(panelImage);

      }

      // ==================================================
      // MENU
      // ==================================================

      const menu =
        new StringSelectMenuBuilder()

          .setCustomId('ticket_menu')

          .setPlaceholder('Open Ticket')

          .addOptions(options);

      const row =
        new ActionRowBuilder()

          .addComponents(menu);

      await interaction.channel.send({

        embeds: [embed],

        components: [row]

      });

      await interaction.reply({

        content:
          'Ticket panel created.',

        ephemeral: true

      });

    }

  }

  // ====================================================
  // CREATE TICKET
  // ====================================================

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'ticket_menu') {

      const data =
        interaction.values[0];

      const split =
        data.split('|');

      const categoryId =
        split[0];

      const section =
        split[1];

      const ticketTitle =
        split[2];

      const ticketDescription =
        split[3];

      const ticketColor =
        split[4];

      ticketCount++;

      const channel =
        await interaction.guild.channels.create({

          name:
            `${section}-${ticketCount}`,

          type:
            ChannelType.GuildText,

          parent:
            categoryId,

          topic:
            interaction.user.id,

          permissionOverwrites: [

            {
              id:
                interaction.guild.id,

              deny: [
                PermissionFlagsBits.ViewChannel
              ]
            },

            {
              id:
                interaction.user.id,

              allow: [

                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory

              ]
            }

          ]

        });

      // ==================================================
      // BUTTONS
      // ==================================================

      const buttons =
        new ActionRowBuilder()

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

      const ticketEmbed =
        new EmbedBuilder()

          .setColor(ticketColor)

          .setTitle(ticketTitle)

          .setDescription(

            ticketDescription

              .replace(
                '{user}',
                `${interaction.user}`
              )

              .replace(
                '{section}',
                section
              )

          )

          .setTimestamp();

      await channel.send({

        content:
          `${interaction.user}`,

        embeds: [ticketEmbed],

        components: [buttons]

      });

      await interaction.reply({

        content:
          `Your ticket was created: ${channel}`,

        ephemeral: true

      });

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

          content:
            'Only staff can claim tickets.',

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

      const ownerId =
        interaction.channel.topic;

      const isOwner =
        interaction.user.id === ownerId;

      const staff =
        isStaff(interaction.member);

      if (!isOwner && !staff) {

        return interaction.reply({

          content:
            'Only the ticket owner or staff can close this ticket.',

          ephemeral: true

        });

      }

      await interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor('#ff0000')

            .setDescription(
              'Ticket closing in 5 seconds.'
            )

        ]

      });

      setTimeout(async () => {

        await interaction.channel.delete()
          .catch(() => {});

      }, 5000);

    }

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
