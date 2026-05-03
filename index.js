process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec } = require("child_process");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");

// ---------------- WEB ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Cálido running"));
app.listen(PORT, "0.0.0.0");

// ---------------- BOT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const fileCache = new Map();

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Audio tools")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit or auto TikTok boost")
        .addAttachmentOption(opt =>
          opt.setName("file").setDescription("Upload audio").setRequired(true)
        )
        .addBooleanOption(opt =>
          opt
            .setName("auto")
            .setDescription("Auto TikTok loud mix")
            .setRequired(true)
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Cálido online as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "audio") {
    const sub = interaction.options.getSubcommand();

    if (sub === "edit") {
      const file = interaction.options.getAttachment("file");
      const auto = interaction.options.getBoolean("auto");

      if (!file.contentType || !file.contentType.startsWith("audio")) {
        return interaction.reply({ content: "Upload a valid audio file." });
      }

      // ===== AUTO MODE (TIKTOK LOUD) =====
      if (auto) {
        await interaction.deferReply();

        const originalName =
          file.url.split("/").pop().split("?")[0] || "audio.mp3";

        const inputPath = path.join(__dirname, "input_" + originalName);
        const outputPath = path.join(__dirname, originalName);

        try {
          const response = await axios({
            url: file.url,
            method: "GET",
            responseType: "stream"
          });

          const writer = fs.createWriteStream(inputPath);
          response.data.pipe(writer);

          await new Promise((res, rej) => {
            writer.on("finish", res);
            writer.on("error", rej);
          });

          // 🔥 TIKTOK LOUD FILTER
          const filter = `
            bass=g=15,
            equalizer=f=100:width_type=o:width=2:g=10,
            equalizer=f=250:width_type=o:width=2:g=-6,
            equalizer=f=2000:width_type=o:width=2:g=8,
            equalizer=f=5000:width_type=o:width=2:g=10,
            treble=g=8,
            acompressor=threshold=-25dB:ratio=6:attack=5:release=80,
            alimiter=limit=0.95,
            volume=2.0
          `.replace(/\s+/g, "");

          const command = `ffmpeg -i "${inputPath}" -af "${filter}" -preset ultrafast -b:a 192k "${outputPath}" -y`;

          exec(command, async (err) => {
            if (err) {
              console.error(err);
              return interaction.editReply("Error processing audio.");
            }

            const embed = new EmbedBuilder()
              .setColor(0x2b2d31)
              .setTitle("TikTok Loud Boost")
              .setDescription("Extreme bass + loud vocals applied");

            await interaction.editReply({
              embeds: [embed],
              files: [new AttachmentBuilder(outputPath)]
            });

            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
          });

        } catch (err) {
          console.error(err);
          interaction.editReply("Failed to process file.");
        }

        return;
      }

      // ===== MANUAL MODE =====
      fileCache.set(interaction.user.id, file.url);

      const modal = new ModalBuilder()
        .setCustomId("audioModal")
        .setTitle("Manual Audio Settings");

      const volume = new TextInputBuilder()
        .setCustomId("volume")
        .setLabel("Volume (1.0 default)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const bass = new TextInputBuilder()
        .setCustomId("bass")
        .setLabel("Bass (0-10)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const treble = new TextInputBuilder()
        .setCustomId("treble")
        .setLabel("Treble (0-10)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(volume),
        new ActionRowBuilder().addComponents(bass),
        new ActionRowBuilder().addComponents(treble)
      );

      return interaction.showModal(modal);
    }
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit() && interaction.customId === "audioModal") {
    await interaction.deferReply();

    const fileUrl = fileCache.get(interaction.user.id);
    if (!fileUrl) return interaction.editReply("Expired. Try again.");

    fileCache.delete(interaction.user.id);

    const volume = interaction.fields.getTextInputValue("volume") || "1.0";
    const bass = interaction.fields.getTextInputValue("bass") || "5";
    const treble = interaction.fields.getTextInputValue("treble") || "5";

    const originalName =
      fileUrl.split("/").pop().split("?")[0] || "audio.mp3";

    const inputPath = path.join(__dirname, "input_" + originalName);
    const outputPath = path.join(__dirname, originalName);

    try {
      const response = await axios({
        url: fileUrl,
        method: "GET",
        responseType: "stream"
      });

      const writer = fs.createWriteStream(inputPath);
      response.data.pipe(writer);

      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });

      const filter = `
        bass=g=${bass},
        treble=g=${treble},
        volume=${volume}
      `.replace(/\s+/g, "");

      const command = `ffmpeg -i "${inputPath}" -af "${filter}" -preset ultrafast -b:a 192k "${outputPath}" -y`;

      exec(command, async (err) => {
        if (err) {
          console.error(err);
          return interaction.editReply("Error processing audio.");
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Audio Edited")
          .setDescription(
            `Volume: ${volume} | Bass: ${bass} | Treble: ${treble}`
          );

        await interaction.editReply({
          embeds: [embed],
          files: [new AttachmentBuilder(outputPath)]
        });

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });

    } catch (err) {
      console.error(err);
      interaction.editReply("Failed to process file.");
    }
  }
});

// ---------------- START ----------------
client.login(TOKEN);
