const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Ready event
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Basic message command example
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // Example command: !ping
  if (message.content.toLowerCase() === '!ping') {
    await message.reply('Pong!');
  }

  // Example command: !info
  if (message.content.toLowerCase() === '!info') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Bot Info')
      .setDescription('This is a clean starter bot.')
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});

// Example slash-command style interaction (button)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'example_button') {
    await interaction.reply({ content: 'Button clicked!', ephemeral: true });
  }
});

client.login(process.env.TOKEN);
