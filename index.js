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
   EXPRESS SERVER FOR RENDER
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

// Store ticket category IDs
const ticketCategories = new Map();

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  // PING COMMAND
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  // SET TICKET COMMAND
  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create a ticket panel')

    // REQUIRED OPTIONS FIRST

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
        .setName('support_category')
        .setDescription('Support category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('billing_category')
        .setDescription('Billing category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('report_category')
        .setDescription('Report category ID')
        .setRequired(true)
    )

    // OPTIONAL OPTIONS LAST

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
   BOT READY
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

      const supportCategory =
        interaction.options.getString('support_category');

      const billingCategory =
        interaction.options.getString('billing_category');

      const reportCategory =
        interaction.options.getString('report_category');

      const image =
        interaction.options.getString('image');

      // SAVE CATEGORY IDS
      ticketCategories.set('support', supportCategory);
      ticketCategories.set('billing', billingCategory);
      ticketCategories.set('report', reportCategory);

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
            label: 'Support',
            description: 'General support help',
            value: 'support',
            emoji: '🎫'
          },
          {
            label: 'Billing',
            description: 'Billing and payments help',
            value: 'billing',
            emoji: '💰'
          },
          {
            label: 'Report User',
            description: 'Report a member',
            value: 'report',
            emoji: '⚠️'
          }
        ]);

      const row =
        new ActionRowBuilder().addComponents(menu);

      // SEND PANEL
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // PRIVATE RESPONSE
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

    // CLOSE TICKET
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
