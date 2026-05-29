// ======================================================
// ADVANCED DISCORD TICKET BOT
// BEAUTIFUL & ORGANIZED
// FEATURES:
// - CUSTOM TICKET PANELS
// - NUMBERED TICKETS
// - CATEGORY TICKET NAMES
// - STAFF CLAIM SYSTEM
// - USER + STAFF CLOSE
// - AUTOMOD
// - INVITE TIMEOUT
// - BLOCKED WORDS
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

require('dotenv').config();

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
// NOTIFY ROLES
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
          'Panel embed color'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('ticket_title')

        .setDescription(
          'Ticket title'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('ticket_description')

        .setDescription(
          'Ticket description'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('ticket_color')

        .setDescription(
          'Ticket embed color'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('section')

        .setDescription(
          'Section name'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('emoji')

        .setDescription(
          'Section emoji'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('category')

        .setDescription(
          'Category ID'
        )

        .setRequired(true)

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

      // ================================================
      // TIMEOUT
      // ================================================

      await message.member.timeout(

        10 * 60 * 1000,
        'Invite Link'

      ).catch(() => {});

      // ================================================
      // WARNING
      // ================================================

      const warn =
        await message.channel.send({

          embeds: [

            new EmbedBuilder()

              .setColor('#ff4d4d')

              .setDescription(
                `${message.author} invite links are not allowed.`
              )

          ]

        });

      setTimeout(() => {

        warn.delete()
          .catch(() => {});

      }, 5000);

      // ================================================
      // DM STAFF
      // ================================================

      for (const roleId of NOTIFY_ROLES) {

        const role =
          message.guild.roles.cache.get(roleId);

        if (!role) continue;

        for (const member of role.members.values()) {

          member.send({

            embeds: [

              new EmbedBuilder()

                .setColor('#ff4d4d')

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
    // BLOCKED WORDS
    // ==================================================

    for (const word of BLOCKED_WORDS) {

      if (content.includes(word)) {

        await message.delete()
          .catch(() => {});

        const warn =
          await message.channel.send({

            embeds: [

              new EmbedBuilder()

                .setColor('#ff4d4d')

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
    // /SETTICKET
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

        const section =
          interaction.options.getString(
            'section'
          );

        const emoji =
          interaction.options.getString(
            'emoji'
          );

        const category =
          interaction.options.getString(
            'category'
          );

        // ==============================================
        // PANEL EMBED
        // ==============================================

        const embed =
          new EmbedBuilder()

            .setColor(panelColor)

            .setTitle(panelTitle)

            .setDescription(panelDescription)

            .setFooter({

              text:
                'Open a ticket using the menu below'

            })

            .setTimestamp();

        // ==============================================
        // DROPDOWN
        // ==============================================

        const menu =
          new StringSelectMenuBuilder()

            .setCustomId(
              'ticket_menu'
            )

            .setPlaceholder(
              'Select a category'
            )

            .addOptions({

              label:
                section,

              emoji:
                emoji,

              value:
                `${category}|${section}|${ticketTitle}|${ticketDescription}|${ticketColor}`

            });

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

        // ==============================================
        // EXISTING TICKET CHECK
        // ==============================================

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

        // ==============================================
        // TICKET NUMBER
        // ==============================================

        const formattedSection =
          section
            .toLowerCase()
            .replace(/\s+/g, '-');

        const ticketCount =
          interaction.guild.channels.cache.filter(

            c =>
              c.name.startsWith(
                formattedSection
              )

          ).size + 1;

        // ==============================================
        // CREATE CHANNEL
        // ==============================================

        const channel =
          await interaction.guild.channels.create({

            name:
              `${formattedSection}-${ticketCount}`,

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

        // ==============================================
        // STAFF ACCESS
        // ==============================================

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

        // ==============================================
        // BUTTONS
        // ==============================================

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

        // ==============================================
        // TICKET EMBED
        // ==============================================

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

              .setColor('#5865f2')

              .setDescription(
                `${interaction.user} claimed this ticket.`
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

              .setColor('#ff4d4d')

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
