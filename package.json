const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
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

// Slash Commands
const commands = [

  // Ping Command
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  // Setup Ticket Command
  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create a custom ticket panel')

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
        .setDescription('Embed HEX color (#5865F2)')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('button_name')
        .setDescription('Button text')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('emoji')
        .setDescription('Button emoji')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Image URL')
        .setRequired(false)
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
      const buttonName = interaction.options.getString('button_name');
      const emoji = interaction.options.getString('emoji');
      const image = interaction.options.getString('image');

      // Embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      // Button
      const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel(buttonName)
        .setStyle(ButtonStyle.Primary);

      if (emoji) {
        button.setEmoji(emoji);
      }

      const row = new ActionRowBuilder().addComponents(button);

      // Send Panel
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // Private Reply
      await interaction.reply({
        content: 'Ticket panel sent successfully.',
        ephemeral: true
      });

    }

  }

  // Buttons
  if (interaction.isButton()) {

    // Create Ticket
    if (interaction.customId === 'create_ticket') {

      const guild = interaction.guild;
      const member = interaction.member;

      // Check Existing Ticket
      const existing = guild.channels.cache.find(
        channel =>
          channel.name === `ticket-${member.user.username.toLowerCase()}`
      );

      if (existing) {

        return interaction.reply({
          content: `You already have a ticket: ${existing}`,
          ephemeral: true
        });

      }

      // Create Channel
      const ticketChannel = await guild.channels.create({
        name: `ticket-${member.user.username}`,
        type: ChannelType.GuildText,

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

      const closeRow = new ActionRowBuilder().addComponents(closeButton);

      // Welcome Message
      await ticketChannel.send({
        content: `Welcome ${member}! Support will be with you shortly.`,
        components: [closeRow]
      });

      // Reply
      await interaction.reply({
        content: `Your ticket has been created: ${ticketChannel}`,
        ephemeral: true
      });

    }

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
