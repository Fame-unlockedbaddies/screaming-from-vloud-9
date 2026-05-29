// ======================================================
// ADVANCED DISCORD TICKET BOT
// FULL JS
// FEATURES:
// - CUSTOM TICKET PANELS
// - 10 OPTIONAL SECTIONS
// - CLAIM BUTTON
// - USER + STAFF CLOSE
// - AUTOMOD
// - BLOCK INVITES
// - TIMEOUT USERS
// - DM STAFF ROLES
// - BLOCK WORDS
// - NUMBERED TICKETS
// - CATEGORY TICKET NAMES
// - RENDER READY
// ======================================================

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

  console.log(
    `Web server running on port ${process.env.PORT || 3000}`
  );

});

// ======================================================
// CONFIG
// ======================================================

const TOKEN =
  process.env.TOKEN;

const CLIENT_ID =
  process.env.CLIENT_ID;

// ======================================================
// STAFF ROLES
// ======================================================

const STAFF_ROLES = [

  '111111111111111111',
  '222222222222222222'

];

// ======================================================
// ROLES TO DM ON TIMEOUT
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
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()

    .setName('setticket')

    .setDescription(
      'Create a custom ticket panel'
    )

    // ==================================================
    // PANEL SETTINGS
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
        .setName('panel_image')
        .setDescription('Panel image URL')
        .setRequired(false)
    )

    // ==================================================
    // 10 OPTIONAL SECTIONS
    // ==================================================

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

    .addStringOption(option =>
      option
        .setName('section6')
        .setDescription('Section 6')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji6')
        .setDescription('Emoji 6')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category6')
        .setDescription('Category ID 6')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section7')
        .setDescription('Section 7')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji7')
        .setDescription('Emoji 7')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category7')
        .setDescription('Category ID 7')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section8')
        .setDescription('Section 8')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji8')
        .setDescription('Emoji 8')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category8')
        .setDescription('Category ID 8')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section9')
        .setDescription('Section 9')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji9')
        .setDescription('Emoji 9')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category9')
        .setDescription('Category ID 9')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('section10')
        .setDescription('Section 10')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji10')
        .setDescription('Emoji 10')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category10')
        .setDescription('Category ID 10')
        .setRequired(false)
    )

].map(command =>
  command.toJSON()
);

// ======================================================
// REGISTER COMMANDS
// ======================================================

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

(async () => {

  try {

    await rest.put(

      Routes.applicationCommands(
        CLIENT_ID
      ),

      { body: commands }

    );

    console.log(
      'Commands Loaded'
    );

  } catch (err) {

    console.log(err);

  }

})();

// ======================================================
// READY
// ======================================================

client.once('ready', () => {

  console.log(
    `${client.user.tag} Online`
  );

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

client.on(
  'messageCreate',

  async message => {

    if (message.author.bot) return;

    if (!message.guild) return;

    const content =
      message.content.toLowerCase();

    // ==================================================
    // BLOCK INVITES
    // ==================================================

    if (

      content.includes('discord.gg/') ||
      content.includes('discord.com/invite/') ||
      content.includes('discordapp.com/invite/')

    ) {

      await message.delete()
        .catch(() => {});

      await message.member.timeout(

        10 * 60 * 1000,
        'Posted invite link'

      ).catch(() => {});

      const warn =
        await message.channel.send({

          embeds: [

            new EmbedBuilder()

              .setColor('#ff0000')

              .setDescription(
                `${message.author} invite links are not allowed and you have been timed out for 10 minutes.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete()
          .catch(() => {});

      }, 5000);

      // ==================================================
      // DM STAFF ROLES
      // ==================================================

      for (const roleId of NOTIFY_ROLES) {

        const role =
          message.guild.roles.cache.get(roleId);

        if (!role) continue;

        for (const member of role.members.values()) {

          member.send({

            embeds: [

              new EmbedBuilder()

                .setColor('#ff0000')

                .setTitle(
                  'User Timed Out'
                )

                .setDescription(
                  `The bot has timed out ${message.author} for posting an invite link.`
                )

            ]

          }).catch(() => {});

        }

      }

      return;

    }

    // ==================================================
    // BLOCK WORDS
    // ==================================================

    for (const word of BLOCKED_WORDS) {

      if (content.includes(word)) {

        await message.delete()
          .catch(() => {});

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

          warn.delete()
            .catch(() => {});

        }, 3000);

        return;

      }

    }

  }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  'interactionCreate',

  async interaction => {

    // ==================================================
    // CREATE PANEL
    // ==================================================

    if (
      interaction.isChatInputCommand()
    ) {

      if (
        interaction.commandName ===
        'setticket'
      ) {

        const panelTitle =
          interaction.options.getString(
            'panel_title'
          );

        const panelDescription =
          interaction.options.getString(
            'panel_description'
          );

        const panelColor =
          interaction.options.getString(
            'panel_color'
          );

        const panelImage =
          interaction.options.getString(
            'panel_image'
          );

        const ticketTitle =
          interaction.options.getString(
            'ticket_title'
          );

        const ticketDescription =
          interaction.options.getString(
            'ticket_description'
          );

        const ticketColor =
          interaction.options.getString(
            'ticket_color'
          );

        const options = [];

        for (let i = 1; i <= 10; i++) {

          const section =
            interaction.options.getString(
              `section${i}`
            );

          const emoji =
            interaction.options.getString(
              `emoji${i}`
            );

          const category =
            interaction.options.getString(
              `category${i}`
            );

          if (
            section &&
            emoji &&
            category
          ) {

            options.push({

              label:
                section,

              emoji:
                emoji,

              value:
                `${category}|${section}|${ticketTitle}|${ticketDescription}|${ticketColor}`

            });

          }

        }

        const embed =
          new EmbedBuilder()

            .setColor(
              panelColor
            )

            .setTitle(
              panelTitle
            )

            .setDescription(
              panelDescription
            )

            .setFooter({

              text:
                'Select a category below'

            })

            .setTimestamp();

        if (panelImage) {

          embed.setImage(
            panelImage
          );

        }

        const menu =
          new StringSelectMenuBuilder()

            .setCustomId(
              'ticket_menu'
            )

            .setPlaceholder(
              'Open Ticket'
            )

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

    // ==================================================
    // CREATE TICKET
    // ==================================================

    if (
      interaction.isStringSelectMenu()
    ) {

      if (
        interaction.customId ===
        'ticket_menu'
      ) {

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

        // ==================================================
        // CHECK EXISTING TICKET
        // ==================================================

        const existing =
          interaction.guild.channels.cache.find(

            c =>
              c.topic === interaction.user.id

          );

        if (existing) {

          return interaction.reply({

            content:
              `You already have a ticket: ${existing}`,

            ephemeral: true

          });

        }

        // ==================================================
        // NUMBERED TICKETS
        // ==================================================

        const formattedSection =
          section
            .toLowerCase()
            .replace(/\s+/g, '-');

        const ticketNumber =
          interaction.guild.channels.cache.filter(

            c =>
              c.name.startsWith(
                formattedSection
              )

          ).size + 1;

        // ==================================================
        // CREATE CHANNEL
        // ==================================================

        const channel =
          await interaction.guild.channels.create({

            name:
              `${formattedSection}-${ticketNumber}`,

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
        // STAFF ACCESS
        // ==================================================

        for (const roleId of STAFF_ROLES) {

          await channel.permissionOverwrites.create(

            roleId,

            {

              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true

            }

          );

        }

        // ==================================================
        // BUTTONS
        // ==================================================

        const buttons =
          new ActionRowBuilder()

            .addComponents(

              new ButtonBuilder()

                .setCustomId(
                  'claim_ticket'
                )

                .setLabel(
                  'Claim'
                )

                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()

                .setCustomId(
                  'close_ticket'
                )

                .setLabel(
                  'Close'
                )

                .setStyle(
                  ButtonStyle.Danger
                )

            );

        // ==================================================
        // TICKET EMBED
        // ==================================================

        const ticketEmbed =
          new EmbedBuilder()

            .setColor(
              ticketColor
            )

            .setTitle(
              ticketTitle
            )

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

            .setFooter({

              text:
                `Ticket Owner: ${interaction.user.tag}`

            })

            .setTimestamp();

        await channel.send({

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

    // ==================================================
    // BUTTONS
    // ==================================================

    if (
      interaction.isButton()
    ) {

      // ==================================================
      // CLAIM TICKET
      // ==================================================

      if (
        interaction.customId ===
        'claim_ticket'
      ) {

        if (
          !isStaff(
            interaction.member
          )
        ) {

          return interaction.reply({

            content:
              'Only staff can claim tickets.',

            ephemeral: true

          });

        }

        await interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setColor('#5865f2')

              .setDescription(
                `${interaction.user} claimed this ticket.`
              )

          ]

        });

      }

      // ==================================================
      // CLOSE TICKET
      // ==================================================

      if (
        interaction.customId ===
        'close_ticket'
      ) {

        const ownerId =
          interaction.channel.topic;

        const isOwner =
          interaction.user.id === ownerId;

        const staff =
          isStaff(
            interaction.member
          );

        if (
          !isOwner &&
          !staff
        ) {

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

  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
