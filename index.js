// ======================================================
// FULL DISCORD BOT
// FEATURES:
// - BLOCKS INVITE LINKS
// - BLOCKS "playgrounds"
// - /addsound COMMAND
// - RENDER WEB SERVER
// ======================================================

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const express = require('express');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

require('dotenv').config();

// ======================================================
// VARIABLES
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ======================================================
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()

    .setName('addsound')

    .setDescription(
      'Add audio to another audio file'
    )

    .addAttachmentOption(option =>
      option

        .setName('original_audio')

        .setDescription(
          'Original audio file'
        )

        .setRequired(true)
    )

    .addAttachmentOption(option =>
      option

        .setName('new_audio')

        .setDescription(
          'New audio file'
        )

        .setRequired(true)
    )

    .addStringOption(option =>
      option

        .setName('position')

        .setDescription(
          'Where should the new audio go?'
        )

        .setRequired(true)

        .addChoices(

          {
            name: 'Start',
            value: 'start'
          },

          {
            name: 'End',
            value: 'end'
          }

        )
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

  console.log(`${client.user.tag} Online`);

});

// ======================================================
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  // IGNORE BOTS

  if (message.author.bot) return;

  // IGNORE DMS

  if (!message.guild) return;

  // ALLOW ADMINS

  if (
    message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) return;

  const content =
    message.content.toLowerCase();

  // ======================================================
  // BLOCK INVITE LINKS
  // ======================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/')
  ) {

    // DELETE MESSAGE

    await message.delete().catch(() => {});

    // SEND WARNING

    const warning =
      await message.channel.send({

        content:
          `${message.author} 😡 Invite links or any promotional links are not allowed.`

      });

    // DELETE WARNING AFTER 3 SECONDS

    setTimeout(async () => {

      warning.delete().catch(() => {});

    }, 3000);

    return;

  }

  // ======================================================
  // BLOCK WORD PLAYGROUNDS
  // ======================================================

  if (
    content.includes('playgrounds')
  ) {

    // DELETE MESSAGE

    await message.delete().catch(() => {});

    // SEND WARNING

    const warning =
      await message.channel.send({

        content:
          `${message.author} 😡 The word "playgrounds" is not allowed here.`

      });

    // DELETE WARNING AFTER 3 SECONDS

    setTimeout(async () => {

      warning.delete().catch(() => {});

    }, 3000);

    return;

  }

});

// ======================================================
// INTERACTIONS
// ======================================================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // ======================================================
  // ADD SOUND COMMAND
  // ======================================================

  if (
    interaction.commandName ===
    'addsound'
  ) {

    await interaction.deferReply();

    const originalAudio =
      interaction.options.getAttachment(
        'original_audio'
      );

    const newAudio =
      interaction.options.getAttachment(
        'new_audio'
      );

    const position =
      interaction.options.getString(
        'position'
      );

    const originalPath =
      path.join(
        __dirname,
        `original_${Date.now()}.mp3`
      );

    const newPath =
      path.join(
        __dirname,
        `new_${Date.now()}.mp3`
      );

    const outputPath =
      path.join(
        __dirname,
        `output_${Date.now()}.mp3`
      );

    // ======================================================
    // DOWNLOAD FILE
    // ======================================================

    const downloadFile =
      async (url, filePath) => {

        const response =
          await fetch(url);

        const buffer =
          Buffer.from(
            await response.arrayBuffer()
          );

        fs.writeFileSync(
          filePath,
          buffer
        );

      };

    try {

      await downloadFile(
        originalAudio.url,
        originalPath
      );

      await downloadFile(
        newAudio.url,
        newPath
      );

      // ======================================================
      // START
      // ======================================================

      if (position === 'start') {

        ffmpeg()

          .input(newPath)

          .input(originalPath)

          .on('end', async () => {

            await interaction.editReply({

              content:
                'Finished audio.',

              files: [outputPath]

            });

            fs.unlinkSync(originalPath);
            fs.unlinkSync(newPath);
            fs.unlinkSync(outputPath);

          })

          .on('error', async err => {

            console.log(err);

            await interaction.editReply(
              'Failed to process audio.'
            );

          })

          .mergeToFile(outputPath);

      }

      // ======================================================
      // END
      // ======================================================

      if (position === 'end') {

        ffmpeg()

          .input(originalPath)

          .input(newPath)

          .on('end', async () => {

            await interaction.editReply({

              content:
                'Finished audio.',

              files: [outputPath]

            });

            fs.unlinkSync(originalPath);
            fs.unlinkSync(newPath);
            fs.unlinkSync(outputPath);

          })

          .on('error', async err => {

            console.log(err);

            await interaction.editReply(
              'Failed to process audio.'
            );

          })

          .mergeToFile(outputPath);

      }

    } catch (err) {

      console.log(err);

      await interaction.editReply(
        'Something went wrong.'
      );

    }

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
