// ======================================================
// FULL DISCORD BOT
// FEATURES:
// - BLOCK INVITES
// - BLOCK "playgrounds"
// - CUSTOM EMBED COLORS
// - CUSTOM TICKET EMBED TITLE
// - CUSTOM TICKET EMBED DESCRIPTION
// - CUSTOM PANEL TITLE
// - CUSTOM PANEL DESCRIPTION
// - CUSTOM PANEL IMAGE
// - CUSTOM SECTIONS
// - CUSTOM EMOJIS
// - CUSTOM CATEGORIES
// - CLAIM BUTTON
// - CLOSE BUTTON
// ======================================================

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

const express = require('express');

require('dotenv').config();

// ======================================================
// VARIABLES
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
// CLIENT
// ======================================================

const client = new Client({

  intents: [

    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent

  ]

});

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();

app.get('/', (req, res) => {

  res.send('Bot Online');

});

app.listen(

  process.env.PORT || 3000,

  () => {

    console.log(
      'Web Server Running'
    );

  }

);

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

    .setDescription(
      'Create a custom ticket panel'
    )

    // ==================================================
    // PANEL SETTINGS
    // ==================================================

    .addStringOption(option =>

      option

        .setName('panel_title')

        .setDescription(
          'Panel title'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('panel_description')

        .setDescription(
          'Panel description'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('panel_color')

        .setDescription(
          'Panel embed color HEX'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('panel_image')

        .setDescription(
          'Panel banner image URL'
        )

        .setRequired(false)

    )

    // ==================================================
    // TICKET EMBED SETTINGS
    // ==================================================

    .addStringOption(option =>

      option

        .setName('ticket_title')

        .setDescription(
          'Ticket embed title'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('ticket_description')

        .setDescription(
          'Ticket embed description'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('ticket_color')

        .setDescription(
          'Ticket embed HEX color'
        )

        .setRequired(true)

    )

    // ==================================================
    // SECTION 1
    // ==================================================

    .addStringOption(option =>

      option

        .setName('section1')

        .setDescription(
          'Section 1 name'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('emoji1')

        .setDescription(
          'Emoji 1'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('category1')

        .setDescription(
          'Category ID 1'
        )

        .setRequired(true)

    )

    // ==================================================
    // SECTION 2
    // ==================================================

    .addStringOption(option =>

      option

        .setName('section2')

        .setDescription(
          'Section 2 name'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('emoji2')

        .setDescription(
          'Emoji 2'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('category2')

        .setDescription(
          'Category ID 2'
        )

        .setRequired(false)

    )

    // ==================================================
    // SECTION 3
    // ==================================================

    .addStringOption(option =>

      option

        .setName('section3')

        .setDescription(
          'Section 3 name'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('emoji3')

        .setDescription(
          'Emoji 3'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('category3')

        .setDescription(
          'Category ID 3'
        )

        .setRequired(false)

    )

    // ==================================================
    // SECTION 4
    // ==================================================

    .addStringOption(option =>

      option

        .setName('section4')

        .setDescription(
          'Section 4 name'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('emoji4')

        .setDescription(
          'Emoji 4'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('category4')

        .setDescription(
          'Category ID 4'
        )

        .setRequired(false)

    )

    // ==================================================
    // SECTION 5
    // ==================================================

    .addStringOption(option =>

      option

        .setName('section5')

        .setDescription(
          'Section 5 name'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('emoji5')

        .setDescription(
          'Emoji 5'
        )

        .setRequired(false)

    )

    .addStringOption(option =>

      option

        .setName('category5')

        .setDescription(
          'Category ID 5'
        )

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

    const content =
      message.content.toLowerCase();

    // ==================================================
    // BLOCK INVITES
    // ==================================================

    if (

      content.includes('discord.gg/') ||
      content.includes('discord.com/invite/')

    ) {

      await message.delete()
        .catch(() => {});

      const warn =
        await message.channel.send({

          embeds: [

            new EmbedBuilder()

              .setColor('#FADADD')

              .setDescription(
                `${message.author} 😡 Invite links are not allowed.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete()
          .catch(() => {});

      }, 3000);

    }

    // ==================================================
    // BLOCK PLAYGROUNDS
    // ==================================================

    if (
      content.includes('playgrounds')
    ) {

      await message.delete()
        .catch(() => {});

      const warn =
        await message.channel.send({

          embeds: [

            new EmbedBuilder()

              .setColor('#FADADD')

              .setDescription(
                `${message.author} 😡 The word "playgrounds" is not allowed.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete()
          .catch(() => {});

      }, 3000);

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
    // /SETTICKET
    // ==================================================

    if (
      interaction.isChatInputCommand()
    ) {

      if (
        interaction.commandName ===
        'setticket'
      ) {

        // ================================================
        // PANEL SETTINGS
        // ================================================

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

        // ================================================
        // TICKET SETTINGS
        // ================================================

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

        // ================================================
        // BUILD SECTIONS
        // ================================================

        const options = [];

        for (let i = 1; i <= 5; i++) {

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

        // ================================================
        // PANEL EMBED
        // ================================================

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
            );

        if (panelImage) {

          embed.setImage(
            panelImage
          );

        }

        // ================================================
        // DROPDOWN
        // ================================================

        const menu =
          new StringSelectMenuBuilder()

            .setCustomId(
              'ticket_menu'
            )

            .setPlaceholder(
              'Choose a section'
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

        ticketCount++;

        const channel =
          await interaction.guild.channels.create({

            name:
              `ticket-${ticketCount}`,

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
                  'ViewChannel'
                ]

              },

              {

                id:
                  interaction.user.id,

                allow: [

                  'ViewChannel',
                  'SendMessages',
                  'ReadMessageHistory'

                ]

              }

            ]

          });

        // ================================================
        // BUTTONS
        // ================================================

        const buttons =
          new ActionRowBuilder()

            .addComponents(

              new ButtonBuilder()

                .setCustomId(
                  'claim_ticket'
                )

                .setLabel(
                  'Claim Ticket'
                )

                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()

                .setCustomId(
                  'close_ticket'
                )

                .setLabel(
                  'Close Ticket'
                )

                .setStyle(
                  ButtonStyle.Danger
                )

            );

        // ================================================
        // TICKET EMBED
        // ================================================

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
            );

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

      // ================================================
      // CLAIM
      // ================================================

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

              .setColor('#FADADD')

              .setDescription(
                `🎟️ ${interaction.user} claimed this ticket.`
              )

          ]

        });

      }

      // ================================================
      // CLOSE
      // ================================================

      if (
        interaction.customId ===
        'close_ticket'
      ) {

        if (
          !isStaff(
            interaction.member
          )
        ) {

          return interaction.reply({

            content:
              'Only staff can close tickets.',

            ephemeral: true

          });

        }

        await interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setColor('#FADADD')

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
