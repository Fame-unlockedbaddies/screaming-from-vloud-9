const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
require('dotenv').config();

// ===== Web server for Render =====
const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
// =================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Register slash commands
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    {
      name: 'vc',
      description: 'Makes the bot join the voice channel you are in'
    }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'vc') {
    const member = interaction.member;

    // Check if the user is in a voice channel
    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to be in a voice channel first!',
        ephemeral: true
      });
    }

    const voiceChannel = member.voice.channel;

    try {
      // Join the voice channel
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      await interaction.reply({
        content: `✅ Joined **${voiceChannel.name}**!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error joining voice channel:', error);
      await interaction.reply({
        content: '❌ Failed to join the voice channel. Make sure I have **Connect** and **Speak** permissions.',
        ephemeral: true
      });
    }
  }
});

// Keep the old message commands (optional)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === '!ping') {
    await message.reply('Pong!');
  }
});

client.login(process.env.TOKEN);
