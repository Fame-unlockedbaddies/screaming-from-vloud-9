const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
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

app.listen(process.env.PORT || 3000, () => {
  console.log(`Web server running on port ${process.env.PORT || 3000}`);
});

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ======================================================
// STAFF ROLES
// ======================================================

const STAFF_ROLES = [
  '111111111111111111',
  '222222222222222222'
];

// ======================================================
// NOTIFY ROLES
// ======================================================

const NOTIFY_ROLES = [
  '1509385192853213184',
  '1482560426972549232',
  '1444833625362403381'
];

// ======================================================
// BLOCKED WORDS
// ======================================================

const BLOCKED_WORDS = [
  'playgrounds',
  'fame 2.0',
  'jay',
  'dm me'
];

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ======================================================
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()

    .setName('setticket')

    .setDescription('Create a ticket panel')

    .addStringOption(option =>
      option
        .setName('panel_title')
        .setDescription('Panel title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('panel_description')
        .setDescription('Panel description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('panel_color')
        .setDescription('Panel color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_title')
        .setDescription('Ticket title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_description')
        .setDescription('Ticket description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('ticket_color')
        .setDescription('Ticket color')
        .setRequired(true)
    )

    // ==================================================
    // SECTION 1
    // ==================================================

    .addStringOption(option =>
      option
        .setName('section1')
        .setDescription('Section 1')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('emoji1')
        .setDescription('Emoji 1')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('category1')
        .setDescription('Category ID 1')
        .setRequired(true)
    )

    // ==================================================
    // SECTION 2
    // ==================================================

    .addStringOption(option =>
      option
        .setName('section2')
        .setDescription('Section 2')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji2')
        .setDescription('Emoji 2')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category2')
        .setDescription('Category ID 2')
        .setRequired(false)
    )

    // ==================================================
    // SECTION 3
    // ==================================================

    .addStringOption(option =>
      option
        .setName('section3')
        .setDescription('Section 3')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji3')
        .setDescription('Emoji 3')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category3')
        .setDescription('Category ID 3')
        .setRequired(false)
    )

    // ==================================================
    // SECTION 4
    // ==================================================

    .addStringOption(option =>
      option
        .setName('section4')
        .setDescription('Section 4')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji4')
        .setDescription('Emoji 4')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category4')
        .setDescription('Category ID 4')
        .setRequired(false)
    )

    // ==================================================
    // SECTION 5
    // ==================================================

    .addStringOption(option =>
      option
        .setName('section5')
        .setDescription('Section 5')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('emoji5')
        .setDescription('Emoji 5')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('category5')
        .setDescription('Category ID 5')
        .setRequired(false)
    )

].map(command => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

const rest = new REST({ version: '10' }).setToken(TOKEN);

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
  console.log(`${client.user.tag} Online`);
});

// ======================================================
// STAFF CHECK
// ======================================================

function isStaff(member) {

  return STAFF_ROLES.some(role =>
    member.roles.cache.has(role)
  );

}

// ======================================================
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.toLowerCase();

  // ====================================================
  // BLOCK INVITES
  // ====================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/') ||
    content.includes('discordapp.com/invite/')
  ) {

    await message.delete().catch(() => {});

    await message.member.timeout(
      10 * 60 * 1000,
      'Posted invite link'
    ).catch(() => {});

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(
            `${message.author} invite links are not allowed.`
          )
      ]
    });

    for (const roleId of NOTIFY_ROLES) {

      const role = message.guild.roles.cache.get(roleId);

      if (!role) continue;

      for (const member of role.members.values()) {

        member.send({
          content: `The bot has timed out ${message.author}.`
        }).catch(() => {});

      }
    }

    return;
  }

  // ====================================================
  // BLOCK WORDS
  // ====================================================

  for (const word of BLOCKED_WORDS) {

    if (content.includes(word)) {

      await message.delete().catch(() => {});

      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(
              `${message.author} we do not use that word.`
            )
        ]
      });

      return;
    }
  }
});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
