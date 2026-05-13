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

require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Store category channel IDs
const ticketCategories = new Map();

// Slash Commands
const commands = [

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

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
        .setDescription('Embed color HEX')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Embed image URL')
        .setRequired(false)
    )

    // Support Category ID
    .addStringOption(option =>
      option
        .setName('support_category')
        .setDescription('Support category channel ID')
        .setRequired(true)
    )

    // Billing Category ID
    .addStringOption(option =>
      option
        .setName('billing_category')
        .setDescription('Billing category channel ID')
        .setRequired(true)
    )

    // Report Category ID
    .addStringOption(option =>
      option
        .setName('report_category')
        .setDescription('Report category channel ID')
        .setRequired(true)
    )

].map(command => command.toJSON());

// Register Commands
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

// Bot Ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Interactions
client.on('interactionCreate', async interaction => {

  // Slash Commands
  if (interaction.isChatInputCommand()) {

    // Ping
    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    // Setup Ticket Panel
    if (interaction.commandName === 'setticket') {

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const image = interaction.options.getString('image');

      // Category IDs
      const supportCategory =
        interaction.options.getString('support_category');

      const billingCategory =
        interaction.options.getString('billing_category');

      const reportCategory =
        interaction.options.getString('report_category');

      // Save category IDs
      ticketCategories.set('support', supportCategory);
      ticketCategories.set('billing', billingCategory);
      ticketCategories.set('report', reportCategory);

      // Embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      // Dropdown Menu
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
            description: 'Payments and billing help',
            value: 'billing',
            emoji: '💰'
          },
          {
            label: 'Report User',
            description: 'Report a user',
            value: 'report',
            emoji: '⚠️'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      // Send Panel
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // Private Reply
      await interaction.reply({
        content: 'Ticket panel created successfully.',
        ephemeral: true
      });

    }

  }

  // Dropdown Menu
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'ticket_menu') {

      const guild = interaction.guild;
      const member = interaction.member;

      const categoryType = interaction.values[0];

      // Get category ID
      const categoryId = ticketCategories.get(categoryType);

      // Check Existing Ticket
      const existing = guild.channels.cache.find(
        channel =>
          channel.name ===
          `${categoryType}-${member.user.username.toLowerCase()}`
      );

      if (existing) {

        return interaction.reply({
          content: `You already have a ${categoryType} ticket: ${existing}`,
          ephemeral: true
        });

      }

      // Create Ticket
      const ticketChannel = await guild.channels.create({

        name: `${categoryType}-${member.user.username}`,

        type: ChannelType.GuildText,

        parent: categoryId,

        permissionOverwrites: [

          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
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

      // Close Button
      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      const closeRow =
        new ActionRowBuilder().addComponents(closeButton);

      // Welcome Message
      await ticketChannel.send({
        content:
          `Welcome ${member}! You created a ${categoryType} ticket.`,
        components: [closeRow]
      });

      // Reply
      await interaction.reply({
        content: `Your ${categoryType} ticket has been created: ${ticketChannel}`,
        ephemeral: true
      });

    }

  }

  // Buttons
  if (interaction.isButton()) {

    // Close Ticket
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

// Login
client.login(TOKEN);
