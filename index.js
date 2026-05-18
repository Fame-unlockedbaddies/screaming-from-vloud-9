// ======================================================
// FULL DISCORD BOT
// FEATURES:
// - BLOCKS INVITE LINKS
// - BLOCKS "playgrounds"
// - /addsound COMMAND
// - CODE LOCK SYSTEM
// - FFmpeg Static Fixed
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
const fs = require('fs');
const path = require('path');

const ffmpeg =
  require('fluent-ffmpeg');

const ffmpegPath =
  require('ffmpeg-static');

ffmpeg.setFfmpegPath(
  ffmpegPath
);

require('dotenv').config();

// ======================================================
// VARIABLES
// ======================================================

const TOKEN =
  process.env.TOKEN;

const CLIENT_ID =
  process.env.CLIENT_ID;

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

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Web server running on port ${PORT}`
  );

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
          'Original audio'
        )

        .setRequired(true)

    )

    .addAttachmentOption(option =>

      option

        .setName('new_audio')

        .setDescription(
          'New audio'
        )

        .setRequired(true)

    )

    .addStringOption(option =>

      option

        .setName('position')

        .setDescription(
          'Where should new audio go?'
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

].map(command =>
  command.toJSON()
);

// ======================================================
// REGISTER COMMANDS
// ======================================================

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

(async () => {

  try {

    await rest.put(

      Routes.applicationCommands(
        CLIENT_ID
      ),

      { body: commands }

    );

    console.log(
      'Commands Loaded'
    );

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
// AUDIO STORAGE
// ======================================================

const audioStorage =
  new Map();

// ======================================================
// AUTOMOD
// ======================================================

client.on(
  'messageCreate',

  async message => {

    if (message.author.bot) return;

    if (!message.guild) return;

    if (

      message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )

    ) return;

    const content =
      message.content.toLowerCase();

    // ==================================================
    // BLOCK INVITES
    // ==================================================

    if (

      content.includes('discord.gg/') ||
      content.includes('discord.com/invite/')

    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({

          content:
            `${message.author} 😡 Invite links or any promotional links are not allowed.`

        });

      setTimeout(async () => {

        warning.delete()
          .catch(() => {});

      }, 3000);

      return;

    }

    // ==================================================
    // BLOCK PLAYGROUNDS
    // ==================================================

    if (
      content.includes('playgrounds')
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({

          content:
            `${message.author} 😡 The word "playgrounds" is not allowed here.`

        });

      setTimeout(async () => {

        warning.delete()
          .catch(() => {});

      }, 3000);

      return;

    }

  }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  'interactionCreate',

  async interaction => {

    // ==================================================
    // SLASH COMMAND
    // ==================================================

    if (
      interaction.isChatInputCommand()
    ) {

      // ================================================
      // ADD SOUND
      // ================================================

      if (
        interaction.commandName ===
        'addsound'
      ) {

        await interaction.deferReply({
          ephemeral: true
        });

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

        const code =
          Math.floor(

            100000 +
            Math.random() * 900000

          ).toString();

        // ================================================
        // DM CODE
        // ================================================

        try {

          await interaction.user.send({

            embeds: [

              new EmbedBuilder()

                .setColor('#ff1493')

                .setTitle(
                  'Your Audio Unlock Code'
                )

                .setDescription(`
Your unlock code is:

# ${code}

Use this code to unlock your finished audio file.
`)

            ]

          });

        } catch (err) {

          return interaction.editReply({

            content:
              'Enable DMs first.'

          });

        }

        // ================================================
        // DOWNLOAD FILES
        // ================================================

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

          // ==============================================
          // START
          // ==============================================

          if (
            position === 'start'
          ) {

            ffmpeg()

              .input(newPath)

              .input(originalPath)

              .on(
                'end',

                async () => {

                  audioStorage.set(

                    interaction.user.id,

                    {
                      code,
                      outputPath
                    }

                  );

                  const row =
                    new ActionRowBuilder()

                      .addComponents(

                        new ButtonBuilder()

                          .setCustomId(
                            'unlock_audio'
                          )

                          .setLabel(
                            'Unlock Audio'
                          )

                          .setStyle(
                            ButtonStyle.Primary
                          )

                      );

                  await interaction.editReply({

                    embeds: [

                      new EmbedBuilder()

                        .setColor('#ff1493')

                        .setTitle(
                          'Audio Ready'
                        )

                        .setDescription(`
Your audio has finished processing.

Press the button below and enter your code to unlock the file.
`)

                    ],

                    components: [row]

                  });

                }

              )

              .on(
                'error',

                async err => {

                  console.log(err);

                  await interaction.editReply({

                    content:
                      'Failed to process audio.'

                  });

                }

              )

              .mergeToFile(outputPath);

          }

          // ==============================================
          // END
          // ==============================================

          if (
            position === 'end'
          ) {

            ffmpeg()

              .input(originalPath)

              .input(newPath)

              .on(
                'end',

                async () => {

                  audioStorage.set(

                    interaction.user.id,

                    {
                      code,
                      outputPath
                    }

                  );

                  const row =
                    new ActionRowBuilder()

                      .addComponents(

                        new ButtonBuilder()

                          .setCustomId(
                            'unlock_audio'
                          )

                          .setLabel(
                            'Unlock Audio'
                          )

                          .setStyle(
                            ButtonStyle.Primary
                          )

                      );

                  await interaction.editReply({

                    embeds: [

                      new EmbedBuilder()

                        .setColor('#ff1493')

                        .setTitle(
                          'Audio Ready'
                        )

                        .setDescription(`
Your audio has finished processing.

Press the button below and enter your code to unlock the file.
`)

                    ],

                    components: [row]

                  });

                }

              )

              .on(
                'error',

                async err => {

                  console.log(err);

                  await interaction.editReply({

                    content:
                      'Failed to process audio.'

                  });

                }

              )

              .mergeToFile(outputPath);

          }

        } catch (err) {

          console.log(err);

          await interaction.editReply({

            content:
              'Something went wrong.'

          });

        }

      }

    }

    // ==================================================
    // BUTTON
    // ==================================================

    if (
      interaction.isButton()
    ) {

      if (
        interaction.customId ===
        'unlock_audio'
      ) {

        const modal =
          new ModalBuilder()

            .setCustomId(
              'audio_unlock_modal'
            )

            .setTitle(
              'Enter Unlock Code'
            );

        const input =
          new TextInputBuilder()

            .setCustomId('code')

            .setLabel(
              'Enter your code'
            )

            .setStyle(
              TextInputStyle.Short
            )

            .setRequired(true);

        const row =
          new ActionRowBuilder()

            .addComponents(input);

        modal.addComponents(row);

        await interaction.showModal(
          modal
        );

      }

    }

    // ==================================================
    // MODAL SUBMIT
    // ==================================================

    if (
      interaction.isModalSubmit()
    ) {

      if (
        interaction.customId ===
        'audio_unlock_modal'
      ) {

        const enteredCode =
          interaction.fields.getTextInputValue(
            'code'
          );

        const data =
          audioStorage.get(
            interaction.user.id
          );

        if (!data) {

          return interaction.reply({

            content:
              'No audio found.',

            ephemeral: true

          });

        }

        if (
          enteredCode !== data.code
        ) {

          return interaction.reply({

            content:
              'Invalid code.',

            ephemeral: true

          });

        }

        // ==============================================
        // SEND AUDIO
        // ==============================================

        await interaction.reply({

          content:
            'Your audio file is ready.',

          files: [
            data.outputPath
          ],

          ephemeral: true

        });

      }

    }

  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
