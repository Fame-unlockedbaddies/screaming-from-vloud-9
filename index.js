# Full `index.js` (Safe Version)

```js
// ======================================================
// FULL DISCORD BOT
// ======================================================

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const express = require('express');
require('dotenv').config();

// ======================================================
// VARIABLES
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

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
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName('find')
    .setDescription('Open finder confirmation menu')

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
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  if (
    message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) return;

  const content = message.content.toLowerCase();

  // ====================================================
  // BLOCK INVITES
  // ====================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/')
  ) {

    await message.delete().catch(() => {});

    const warning = await message.channel.send({
      content: `${message.author} 😡 Invite links are not allowed.`
    });

    setTimeout(() => {
      warning.delete().catch(() => {});
    }, 3000);

    return;

  }

  // ====================================================
  // BLOCK PLAYGROUNDS
  // ====================================================

  if (content.includes('playgrounds')) {

    await message.delete().catch(() => {});

    const warning = await message.channel.send({
      content: `${message.author} 😡 The word playgrounds is not allowed here.`
    });

    setTimeout(() => {
      warning.delete().catch(() => {});
    }, 3000);

    return;

  }

});

// ======================================================
// INTERACTIONS
// ======================================================

client.on('interactionCreate', async interaction => {

  // ====================================================
  // SLASH COMMANDS
  // ====================================================

  if (interaction.isChatInputCommand()) {

    // ==================================================
    // FIND COMMAND
    // ==================================================

    if (interaction.commandName === 'find') {

      const embed = new EmbedBuilder()
        .setColor('#ff1493')
        .setTitle('Finder Confirmation')
        .setDescription('Press Do It to continue or No to cancel.');

      const row = new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId('find_do_it')
            .setLabel('Do It')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId('find_no')
            .setLabel('No')
            .setStyle(ButtonStyle.Danger)

        );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    }

  }

  // ====================================================
  // BUTTONS
  // ====================================================

  if (interaction.isButton()) {

    // ==================================================
    // FIND NO BUTTON
    // ==================================================

    if (interaction.customId === 'find_no') {

      return interaction.update({
        content: 'Finder cancelled.',
        embeds: [],
        components: []
      });

    }

    // ==================================================
    // FIND DO IT BUTTON
    // ==================================================

    if (interaction.customId === 'find_do_it') {

      try {

        await interaction.user.send({

          embeds: [

            new EmbedBuilder()
              .setColor('#00ff99')
              .setTitle('Finder Results')
              .setDescription('Placeholder DM message.')

          ]

        });

        await interaction.update({
          content: 'Check your DMs.',
          embeds: [],
          components: []
        });

      } catch (err) {

        await interaction.update({
          content: 'Enable DMs first.',
          embeds: [],
          components: []
        });

      }

    }

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
```
