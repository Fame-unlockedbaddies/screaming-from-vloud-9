const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  AttachmentBuilder
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, registerFont } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const express = require('express');
const fetch = require('node-fetch');
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
    },
    {
      name: 'gif',
      description: 'Add text to an image and turn it into a GIF'
    }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ========== /vc ==========
  if (interaction.commandName === 'vc') {
    const member = interaction.member;

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to be in a voice channel first!',
        ephemeral: true
      });
    }

    try {
      joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      await interaction.reply({
        content: `✅ Joined **${member.voice.channel.name}**!`,
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Failed to join. Make sure I have Connect + Speak permissions.',
        ephemeral: true
      });
    }
  }

  // ========== /gif ==========
  if (interaction.commandName === 'gif') {
    await interaction.reply({
      content: '📸 Please **upload an image** in the next message (you have 60 seconds).',
      ephemeral: true
    });

    // Collect the image
    const imageFilter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0;
    const imageCollected = await interaction.channel.awaitMessages({
      filter: imageFilter,
      max: 1,
      time: 60000,
      errors: ['time']
    }).catch(() => null);

    if (!imageCollected) {
      return interaction.followUp({ content: '⏰ Timed out. Please run `/gif` again.', ephemeral: true });
    }

    const imageMessage = imageCollected.first();
    const attachment = imageMessage.attachments.first();

    // Ask for text
    await interaction.followUp({
      content: '✏️ Now send the **text** you want on the GIF (you have 60 seconds).',
      ephemeral: true
    });

    const textFilter = (m) => m.author.id === interaction.user.id && m.content.length > 0;
    const textCollected = await interaction.channel.awaitMessages({
      filter: textFilter,
      max: 1,
      time: 60000,
      errors: ['time']
    }).catch(() => null);

    if (!textCollected) {
      return interaction.followUp({ content: '⏰ Timed out. Please run `/gif` again.', ephemeral: true });
    }

    const text = textCollected.first().content;

    try {
      await interaction.followUp({ content: '⏳ Creating your GIF...', ephemeral: true });

      // Download the image
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Load image
      const img = await loadImage(buffer);

      // Create canvas
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Add text (white with black outline so it shows on any background)
      const fontSize = Math.floor(img.width / 12);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const x = canvas.width / 2;
      const y = canvas.height - fontSize;

      // Black outline
      ctx.strokeStyle = 'black';
      ctx.lineWidth = fontSize / 8;
      ctx.strokeText(text, x, y);

      // White fill
      ctx.fillStyle = 'white';
      ctx.fillText(text, x, y);

      // Create GIF
      const encoder = new GIFEncoder(canvas.width, canvas.height);
      encoder.start();
      encoder.setRepeat(0);   // 0 = loop forever
      encoder.setDelay(100);
      encoder.setQuality(10);

      encoder.addFrame(ctx);
      encoder.finish();

      const gifBuffer = encoder.out.getData();

      const gifAttachment = new AttachmentBuilder(gifBuffer, { name: 'text-gif.gif' });

      await interaction.followUp({
        content: `✅ Here’s your GIF with the text **"${text}"**:`,
        files: [gifAttachment]
      });

    } catch (error) {
      console.error('GIF creation error:', error);
      await interaction.followUp({
        content: '❌ Failed to create the GIF. Make sure the image is valid.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);
