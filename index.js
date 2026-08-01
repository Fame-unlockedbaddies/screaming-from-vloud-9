const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// Web server for Render
const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Data storage
const dataPath = './data.json';
let data = {
  prefixes: {}
};

if (fs.existsSync(dataPath)) {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getPrefix(guildId) {
  return data.prefixes[guildId] || '!';
}

// Slash commands
const commands = [
  {
    name: 'prefix',
    description: 'View or change the bot prefix',
    options: [
      {
        name: 'set',
        description: 'Set a new prefix',
        type: 1,
        options: [
          {
            name: 'newprefix',
            description: 'The new prefix',
            type: 3,
            required: true
          }
        ]
      }
    ]
  }
];

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'prefix') {
    const sub = interaction.options.getSubcommand(false);

    if (sub === 'set') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'You need Manage Server permission to change the prefix.', ephemeral: true });
      }

      const newPrefix = interaction.options.getString('newprefix');

      if (newPrefix.length > 5) {
        return interaction.reply({ content: 'Prefix cannot be longer than 5 characters.', ephemeral: true });
      }

      data.prefixes[interaction.guild.id] = newPrefix;
      saveData();

      return interaction.reply(`Prefix has been changed to \`${newPrefix}\``);
    }

    const current = getPrefix(interaction.guild.id);
    return interaction.reply(`Current prefix is \`${current}\`\nUse \`/prefix set <newprefix>\` to change it.`);
  }
});

// Handle message commands
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = getPrefix(message.guild.id);

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== PING =====
  if (command === 'ping') {
    return message.reply('Pong!');
  }

  // ===== PREFIX =====
  if (command === 'prefix') {
    return message.reply(`Current prefix is \`${prefix}\``);
  }

  // ===== HELP =====
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help')
      .setDescription('List of available commands')
      .addFields(
        { name: 'ping', value: 'Check if the bot is online', inline: true },
        { name: 'prefix', value: 'Show the current prefix', inline: true },
        { name: 'lock', value: 'Lock the current channel', inline: true },
        { name: 'unlock', value: 'Unlock the current channel', inline: true },
        { name: 'help', value: 'Show this message', inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
  }

  // ===== LOCK =====
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();

      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });

      const lockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Locked')
        .setDescription(`This channel has been locked by **${message.author.tag}**.\n\nMembers can no longer send messages.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [lockEmbed] });
    } catch (err) {
      console.error(err);
      return message.reply('Failed to lock the channel. Make sure I have Manage Channels permission.');
    }
  }

  // ===== UNLOCK =====
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();

      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });

      const unlockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Unlocked')
        .setDescription(`This channel has been unlocked by **${message.author.tag}**.\n\nMembers can now send messages again.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [unlockEmbed] });
    } catch (err) {
      console.error(err);
      return message.reply('Failed to unlock the channel. Make sure I have Manage Channels permission.');
    }
  }
});

client.login(process.env.TOKEN);
