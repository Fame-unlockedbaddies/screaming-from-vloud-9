const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const express = require('express');
require('dotenv').config();

/* =========================
   EXPRESS SERVER
========================= */

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is online.');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

/* =========================
   DISCORD BOT
========================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Store category IDs
const ticketCategories = new Map();

// Store emojis
const ticketEmojis = new Map();

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  // PING
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  // SET TICKET
  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create a custom ticket panel')

    // REQUIRED

    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Embed title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Embed description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed HEX color')
        .setRequired(true)
    )

    // CATEGORY IDS

    .addStringOption(option =>
      option
        .setName('report_category')
        .setDescription('Report category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_category')
        .setDescription('General category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_category')
        .setDescription('Creator category ID')
        .setRequired(true)
    )

    // EMOJIS

    .addStringOption(option =>
      option
        .setName('report_emoji')
        .setDescription('Emoji for Report section')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_emoji')
        .setDescription('Emoji for General section')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_emoji')
        .setDescription('Emoji for Creator section')
        .setRequired(true)
    )

    // OPTIONAL

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Embed image URL')
        .setRequired(false)
    )

].map(command => command.toJSON());

/* =========================
   REGISTER COMMANDS
========================= */

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Slash commands registered.');

  } catch (error) {
    console.error(error);
  }

})();

/* =========================
   READY
========================= */

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* =========================
   INTERACTIONS
========================= */

client.on('interactionCreate', async interaction => {

  /* =========================
     SLASH COMMANDS
  ========================= */

  if (interaction.isChatInputCommand()) {

    // PING

    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    // SET TICKET

    if (interaction.commandName === 'setticket') {

      const title =
        interaction.options.getString('title');

      const description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

      // CATEGORY IDS

      const reportCategory =
        interaction.options.getString('report_category');

      const generalCategory =
        interaction.options.getString('general_category');

      const creatorCategory =
        interaction.options.getString('creator_category');

      // EMOJIS

      const reportEmoji =
        interaction.options.getString('report_emoji');

      const generalEmoji =
        interaction.options.getString('general_emoji');

      const creatorEmoji =
        interaction.options.getString('creator_emoji');

      // SAVE CATEGORY IDS

      ticketCategories.set(
        'report_exploiter',
        reportCategory
      );

      ticketCategories.set(
        'general',
        generalCategory
      );

      ticketCategories.set(
        'content_creator',
        creatorCategory
      );

      // SAVE EMOJIS

      ticketEmojis.set(
        'report_exploiter',
        reportEmoji
      );

      ticketEmojis.set(
        'general',
        generalEmoji
      );

      ticketEmojis.set(
        'content_creator',
        creatorEmoji
      );

      // EMBED

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      // DROPDOWN MENU

      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_menu')
        .setPlaceholder('Choose a ticket section')

        .addOptions([

          {
            label: 'Report a Exploiter',
            description: 'Report exploiters or cheaters',
            value: 'report_exploiter',
            emoji: reportEmoji
          },

          {
            label: 'General',
            description: 'General support',
            value: 'general',
            emoji: generalEmoji
          },

          {
            label: 'Content Creator',
            description: 'Creator applications/support',
            value: 'content_creator',
            emoji: creatorEmoji
          }

        ]);

      const row =
        new ActionRowBuilder().addComponents(menu);

      // SEND PANEL

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // PRIVATE REPLY

      await interaction.reply({
        content: 'Ticket panel created successfully.',
        ephemeral: true
      });

    }

  }

  /* =========================
     SELECT MENU
  ========================= */

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'ticket_menu') {

      const guild = interaction.guild;
      const member = interaction.member;

      const ticketType =
        interaction.values[0];

      // CATEGORY ID

      const categoryId =
        ticketCategories.get(ticketType);

      // CHECK EXISTING

      const existingTicket =
        guild.channels.cache.find(channel =>
          channel.name ===
          `${ticketType}-${member.user.username.toLowerCase()}`
        );

      if (existingTicket) {

        return interaction.reply({
          content:
            `You already have a ${ticketType} ticket: ${existingTicket}`,
          ephemeral: true
        });

      }

      // CREATE CHANNEL

      const ticketChannel =
        await guild.channels.create({

          name:
            `${ticketType}-${member.user.username}`,

          type: ChannelType.GuildText,

          parent: categoryId,

          permissionOverwrites: [

            {
              id: guild.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
            },

            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }

          ]

        });

      // CLOSE BUTTON

      const closeButton =
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

      const closeRow =
        new ActionRowBuilder().addComponents(closeButton);

      // SEND MESSAGE

      await ticketChannel.send({
        content:
          `Welcome ${member}! You created a ${ticketType} ticket.`,
        components: [closeRow]
      });

      // REPLY

      await interaction.reply({
        content:
          `Your ${ticketType} ticket has been created: ${ticketChannel}`,
        ephemeral: true
      });

    }

  }

  /* =========================
     BUTTONS
  ========================= */

  if (interaction.isButton()) {

    if (interaction.customId === 'close_ticket') {

      await interaction.reply({
        content: 'Closing ticket in 5 seconds...',
        ephemeral: true
      });

      setTimeout(async () => {

        await interaction.channel.delete();

      }, 5000);

    }

  }

});

/* =========================
   LOGIN
========================= */

client.login(TOKEN);
