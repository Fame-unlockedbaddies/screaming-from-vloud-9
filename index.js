// ======================================================
// FULL FAME BOT
// ======================================================

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

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ======================================================
// VARIABLES
// ======================================================

let ticketCount = 0;
let autoRoleId = null;

const ticketCategories = new Map();

const userWarnings = new Map();
const userMessages = new Map();

const MEMBER_ROLE_ID = '1505041194156167339';
const QAQ_ROLE_ID = '1497660027274530927';
const CONTENT_CREATOR_ROLE_ID = '1502715193975771257';

// ======================================================
// EMOJI CONVERTER
// ======================================================

function convertCustomEmojis(text, guild) {

  if (!text) return text;

  const regex = /:([a-zA-Z0-9_]+):/g;

  return text.replace(regex, (match, emojiName) => {

    const emoji =
      guild.emojis.cache.find(
        e => e.name === emojiName
      );

    if (emoji) {
      return `<:${emoji.name}:${emoji.id}>`;
    }

    return match;

  });

}

// ======================================================
// WARNING SYSTEM
// ======================================================

async function warnUser(message, reason) {

  const warns =
    userWarnings.get(message.author.id) || 0;

  const newWarns = warns + 1;

  userWarnings.set(
    message.author.id,
    newWarns
  );

  const embed =
    new EmbedBuilder()

      .setColor('#ff0000')

      .setTitle('Rule Violation')

      .setDescription(`
${message.author}

Reason: **${reason}**

Warnings: **${newWarns}/3**
`);

  await message.channel.send({
    embeds: [embed]
  });

  if (newWarns >= 3) {

    try {

      await message.member.timeout(
        10 * 60 * 1000,
        'Too many warnings'
      );

      await message.channel.send({
        embeds: [

          new EmbedBuilder()

            .setColor('#ff0000')

            .setTitle('User Timed Out')

            .setDescription(
              `${message.author} was timed out for repeated violations.`
            )

        ]
      });

    } catch (err) {

      console.log(err);

    }

  }

}

// ======================================================
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping command'),

  new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('Send embed')

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
        .setDescription('Embed color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Embed image')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create ticket panel')

    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('report_category')
        .setDescription('Report category')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_category')
        .setDescription('General category')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_category')
        .setDescription('Creator category')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('report_emoji')
        .setDescription('Report emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_emoji')
        .setDescription('General emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_emoji')
        .setDescription('Creator emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Image')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Set auto role')

    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('scanserver')
    .setDescription('Scan shared users')

    .addStringOption(option =>
      option
        .setName('serverid')
        .setDescription('Server ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Check warnings')

    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear warnings')

    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )

].map(command => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Commands Loaded');

  } catch (err) {

    console.log(err);

  }

})();

// ======================================================
// READY
// ======================================================

client.once('ready', () => {

  console.log(
    `${client.user.tag} Online`
  );

});

// ======================================================
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  if (!message.guild) return;
  if (message.author.bot) return;

  const content =
    message.content.toLowerCase();

  // RESPECT RULES

  const disrespectWords = [
    'nigger',
    'faggot',
    'retard',
    'kys',
    'kill yourself'
  ];

  if (
    disrespectWords.some(word =>
      content.includes(word)
    )
  ) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'Disrespectful language'
    );

  }

  // SPAM

  const userData =
    userMessages.get(message.author.id) || {
      count: 0,
      lastMessage: Date.now()
    };

  if (
    Date.now() - userData.lastMessage <
    3000
  ) {

    userData.count++;

  } else {

    userData.count = 1;

  }

  userData.lastMessage = Date.now();

  userMessages.set(
    message.author.id,
    userData
  );

  if (userData.count >= 5) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'Spam or flooding'
    );

  }

  // CAPS

  if (
    message.content.length > 10 &&
    message.content ===
    message.content.toUpperCase()
  ) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'Excessive caps'
    );

  }

  // MASS PING

  if (
    message.mentions.users.size >= 5
  ) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'Mass pinging'
    );

  }

  // ADVERTISING

  if (
    content.includes('discord.gg/')
  ) {

    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {

      await message.delete().catch(() => {});

      return warnUser(
        message,
        'Advertising'
      );

    }

  }

  // NSFW

  const nsfwWords = [
    'porn',
    'nudes',
    'xxx',
    'gore'
  ];

  if (
    nsfwWords.some(word =>
      content.includes(word)
    )
  ) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'NSFW content'
    );

  }

  // EXPLOITING

  const exploitWords = [
    'synapse',
    'executor',
    'aimbot',
    'cheat client'
  ];

  if (
    exploitWords.some(word =>
      content.includes(word)
    )
  ) {

    await message.delete().catch(() => {});

    return warnUser(
      message,
      'Exploiting discussion'
    );

  }

});

// ======================================================
// INTERACTIONS
// ======================================================

client.on('interactionCreate', async interaction => {

  // ======================================================
  // SLASH COMMANDS
  // ======================================================

  if (interaction.isChatInputCommand()) {

    // PING

    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    // SEND MESSAGE

    if (interaction.commandName === 'sendmessage') {

      let title =
        interaction.options.getString('title');

      let description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

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

      const embed =
        new EmbedBuilder()

          .setTitle(title)

          .setDescription(description)

          .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: 'Message sent.',
        ephemeral: true
      });

    }

    // AUTO ROLE

    if (interaction.commandName === 'autorole') {

      const role =
        interaction.options.getRole('role');

      autoRoleId = role.id;

      const members =
        await interaction.guild.members.fetch();

      let count = 0;

      for (const [, member] of members) {

        if (member.user.bot) continue;

        if (
          member.roles.cache.has(role.id)
        ) continue;

        await member.roles.add(role.id);

        count++;

      }

      return interaction.reply({

        content:
          `Auto role set to ${role}. Added to ${count} users.`,

        ephemeral: true

      });

    }

    // WARNINGS

    if (interaction.commandName === 'warnings') {

      const user =
        interaction.options.getUser('user');

      const warns =
        userWarnings.get(user.id) || 0;

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor('#ff1493')

            .setTitle('Warnings')

            .setDescription(
              `${user}\nWarnings: **${warns}/3**`
            )

        ],

        ephemeral: true

      });

    }

    // CLEAR WARNINGS

    if (interaction.commandName === 'clearwarnings') {

      const user =
        interaction.options.getUser('user');

      userWarnings.set(user.id, 0);

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor('#00ff00')

            .setTitle('Warnings Cleared')

            .setDescription(
              `Warnings cleared for ${user}`
            )

        ]

      });

    }

  }

});

// ======================================================
// AUTO ROLE JOIN
// ======================================================

client.on('guildMemberAdd', async member => {

  if (member.user.bot) return;

  if (!autoRoleId) return;

  try {

    await member.roles.add(autoRoleId);

  } catch (err) {

    console.log(err);

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
