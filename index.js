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

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Advanced audio tools")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit audio with full controls")
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

  // ===== OPEN MODAL =====
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "audio" &&
    interaction.options.getSubcommand() === "edit"
  ) {
    const modal = new ModalBuilder()
      .setCustomId("audioEditModal")
      .setTitle("Audio Editor");

    const file = new TextInputBuilder()
      .setCustomId("file")
      .setLabel("Audio URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const volume = new TextInputBuilder()
      .setCustomId("volume")
      .setLabel("Volume (1.0 = normal, 2.0 = loud)")
      .setStyle(TextInputStyle.Short);

    const pitch = new TextInputBuilder()
      .setCustomId("pitch")
      .setLabel("Pitch (1.0 = normal, 1.2 = higher)")
      .setStyle(TextInputStyle.Short);

    const bass = new TextInputBuilder()
      .setCustomId("bass")
      .setLabel("Bass (0-20)")
      .setStyle(TextInputStyle.Short);

    const treble = new TextInputBuilder()
      .setCustomId("treble")
      .setLabel("Treble (0-20)")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(file),
      new ActionRowBuilder().addComponents(volume),
      new ActionRowBuilder().addComponents(pitch),
      new ActionRowBuilder().addComponents(bass),
      new ActionRowBuilder().addComponents(treble)
    );

    return interaction.showModal(modal);
  }

  // ===== HANDLE MODAL =====
  if (interaction.isModalSubmit() && interaction.customId === "audioEditModal") {
    await interaction.deferReply();

    const fileUrl = interaction.fields.getTextInputValue("file");
    const volume = interaction.fields.getTextInputValue("volume") || "1.0";
    const pitch = interaction.fields.getTextInputValue("pitch") || "1.0";
    const bass = interaction.fields.getTextInputValue("bass") || "0";
    const treble = interaction.fields.getTextInputValue("treble") || "0";

    try {
      // Extract original filename
      const originalName = fileUrl.split("/").pop().split("?")[0] || "audio.mp3";

      const inputPath = path.join(__dirname, "input_" + originalName);
      const outputPath = path.join(__dirname, originalName);

      // DOWNLOAD
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

      // FILTER BUILD
      const filter = `
        volume=${volume},
        asetrate=44100*${pitch},
        bass=g=${bass},
        treble=g=${treble}
      `.replace(/\s+/g, "");

      const command = `ffmpeg -i "${inputPath}" -af "${filter}" "${outputPath}" -y`;

      exec(command, async (err) => {
        if (err) {
          console.error(err);
          return interaction.editReply("Error processing audio.");
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Audio Processed")
          .setDescription(
            `Volume: ${volume}\nPitch: ${pitch}\nBass: ${bass}\nTreble: ${treble}`
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
