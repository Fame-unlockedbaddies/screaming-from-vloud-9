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
  res.send('Fame bot is online.');
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

// Ticket categories
const ticketCategories = new Map();

// Ticket counter
let ticketCount = 0;

/* =========================
   CUSTOM EMOJI SYSTEM
========================= */

function convertCustomEmojis(text, guild) {

  if (!text) return text;

  // NORMAL EMOJIS

  text = text
    .replace(/:heart:/g, '❤️')
    .replace(/:fire:/g, '🔥')
    .replace(/:star:/g, '⭐')
    .replace(/:sparkles:/g, '✨')
    .replace(/:ticket:/g, '🎫')
    .replace(/:warning:/g, '⚠️')
    .replace(/:money:/g, '💰')
    .replace(/:camera:/g, '📸')
    .replace(/:video:/g, '📹')
    .replace(/:crown:/g, '👑')
    .replace(/:check:/g, '✅');

  // CUSTOM SERVER EMOJIS
  // Example: :rightpurplearrow:

  const regex = /:([a-zA-Z0-9_]+):/g;

  text = text.replace(regex, (match, emojiName) => {

    const emoji =
      guild.emojis.cache.find(
        e => e.name === emojiName
      );

    if (emoji) {
      return `<:${emoji.name}:${emoji.id}>`;
    }

    return match;

  });

  return text;

}

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  /* =========================
     PING
  ========================= */

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  /* =========================
     SEND MESSAGE
  ========================= */

  new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('Send a custom embed')

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

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Embed image URL')
        .setRequired(false)
    ),

  /* =========================
     SET TICKET
  ========================= */

  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create a ticket panel')

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
        .setDescription('Emoji for report section')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_emoji')
        .setDescription('Emoji for general section')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_emoji')
        .setDescription('Emoji for creator section')
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

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

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

  console.log(
    `Logged in as ${client.user.tag}`
  );

});

/* =========================
   INTERACTIONS
========================= */

client.on('interactionCreate', async interaction => {

  /* =========================
     SLASH COMMANDS
  ========================= */

  if (interaction.isChatInputCommand()) {

    /* =========================
       PING
    ========================= */

    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    /* =========================
       SEND MESSAGE
    ========================= */

    if (interaction.commandName === 'sendmessage') {

      let title =
        interaction.options.getString('title');

      let description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

      // CUSTOM EMOJIS

      title =
        convertCustomEmojis(
          title,
          interaction.guild
        );

      description =
        convertCustomEmojis(
          description,
          interaction.guild
        );

      // EMBED

      const embed =
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      // SEND EMBED

      await interaction.channel.send({
        embeds: [embed]
      });

      // PRIVATE REPLY

      await interaction.reply({
        content: 'Message sent.',
        ephemeral: true
      });

    }

    /* =========================
       SET TICKET PANEL
    ========================= */

    if (interaction.commandName === 'setticket') {

      let title =
        interaction.options.getString('title');

      let description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

      // CUSTOM EMOJIS

      title =
        convertCustomEmojis(
          title,
          interaction.guild
        );

      description =
        convertCustomEmojis(
          description,
          interaction.guild
        );

      // CATEGORY IDS

      const reportCategory =
        interaction.options.getString(
          'report_category'
        );

      const generalCategory =
        interaction.options.getString(
          'general_category'
        );

      const creatorCategory =
        interaction.options.getString(
          'creator_category'
        );

      // DROPDOWN EMOJIS

      const reportEmoji =
        interaction.options.getString(
          'report_emoji'
        );

      const generalEmoji =
        interaction.options.getString(
          'general_emoji'
        );

      const creatorEmoji =
        interaction.options.getString(
          'creator_emoji'
        );

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

      // EMBED

      const embed =
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      // DROPDOWN

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId('ticket_menu')
          .setPlaceholder(
            'Choose a ticket section'
          )

          .addOptions([

            {
              label: 'Report a Exploiter',
              description:
                'Report exploiters',
              value:
                'report_exploiter',
              emoji:
                reportEmoji
            },

            {
              label: 'General',
              description:
                'General support',
              value:
                'general',
              emoji:
                generalEmoji
            },

            {
              label: 'Content Creator',
              description:
                'Creator support',
              value:
                'content_creator',
              emoji:
                creatorEmoji
            }

          ]);

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      // SEND PANEL

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // PRIVATE REPLY

      await interaction.reply({
        content:
          'Ticket panel created.',
        ephemeral: true
      });

    }

  }

  /* =========================
     DROPDOWN MENU
  ========================= */

  if (interaction.isStringSelectMenu()) {

    if (
      interaction.customId ===
      'ticket_menu'
    ) {

      const guild =
        interaction.guild;

      const member =
        interaction.member;

      const ticketType =
        interaction.values[0];

      // CATEGORY ID

      const categoryId =
        ticketCategories.get(
          ticketType
        );

      // CHECK EXISTING TICKET

      const existingTicket =
        guild.channels.cache.find(
          channel =>
            channel.topic ===
            member.id
        );

      if (existingTicket) {

        return interaction.reply({
          content:
            `You already have a ticket: ${existingTicket}`,
          ephemeral: true
        });

      }

      // INCREASE COUNT

      ticketCount++;

      // CREATE CHANNEL

      const ticketChannel =
        await guild.channels.create({

          name:
            `ticket-${ticketCount}`,

          topic:
            member.id,

          type:
            ChannelType.GuildText,

          parent:
            categoryId,

          permissionOverwrites: [

            {
              id:
                guild.id,

              deny: [
                PermissionsBitField
                  .Flags
                  .ViewChannel
              ]
            },

            {
              id:
                member.id,

              allow: [
                PermissionsBitField
                  .Flags
                  .ViewChannel,

                PermissionsBitField
                  .Flags
                  .SendMessages,

                PermissionsBitField
                  .Flags
                  .ReadMessageHistory
              ]
            }

          ]

        });

      /* =========================
         BUTTONS
      ========================= */

      const claimButton =
        new ButtonBuilder()
          .setCustomId(
            'claim_ticket'
          )
          .setLabel(
            'Claim Ticket'
          )
          .setStyle(
            ButtonStyle.Primary
          );

      const closeButton =
        new ButtonBuilder()
          .setCustomId(
            'close_ticket'
          )
          .setLabel(
            'Close Ticket'
          )
          .setStyle(
            ButtonStyle.Danger
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            claimButton,
            closeButton
          );

      // EMBED

      const ticketEmbed =
        new EmbedBuilder()
          .setTitle(
            '🎫 TICKET'
          )
          .setDescription(
            `Welcome to Fame support ${member}`
          )
          .setColor(
            '#8b5cf6'
          )
          .setFooter({
            text:
              'Fame Support System'
          });

      // SEND MESSAGE

      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [row]
      });

      // REPLY

      await interaction.reply({
        content:
          `Your ticket has been created: ${ticketChannel}`,
        ephemeral: true
      });

    }

  }

  /* =========================
     BUTTONS
  ========================= */

  if (interaction.isButton()) {

    /* =========================
       CLAIM TICKET
    ========================= */

    if (
      interaction.customId ===
      'claim_ticket'
    ) {

      // OWNER ID

      const ticketOwnerId =
        interaction.channel.topic;

      // OWNER CHECK

      const isOwner =
        interaction.user.id ===
        ticketOwnerId;

      // STAFF CHECK

      const hasStaffRole =
        interaction.member.permissions.has(
          PermissionsBitField
            .Flags
            .ManageChannels
        );

      // BLOCK USER

      if (
        isOwner &&
        !hasStaffRole
      ) {

        return interaction.reply({
          content:
            'You cannot claim your own ticket.',
          ephemeral: true
        });

      }

      // CLAIM MESSAGE

      await interaction.reply({
        content:
          `✅ ${interaction.user} claimed this ticket.`
      });

    }

    /* =========================
       CLOSE TICKET
    ========================= */

    if (
      interaction.customId ===
      'close_ticket'
    ) {

      await interaction.reply({
        content:
          'Closing ticket in 5 seconds...',
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
