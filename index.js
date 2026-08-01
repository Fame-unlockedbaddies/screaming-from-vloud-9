const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  PermissionFlagsBits
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

    // Show current prefix
    const current = getPrefix(interaction.guild.id);
    return interaction.reply(`Current prefix is \`${current}\`\nUse \`/prefix set <newprefix>\` to change it.`);
  }
});

// Handle message commands with custom prefix
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = getPrefix(message.guild.id);

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    return message.reply('Pong!');
  }

  if (command === 'prefix') {
    return message.reply(`Current prefix is \`${prefix}\``);
  }

  if (command === 'help') {
    return message.reply(`Current prefix: \`${prefix}\`\nCommands: ping, prefix, help`);
  }
});

client.login(process.env.TOKEN);
