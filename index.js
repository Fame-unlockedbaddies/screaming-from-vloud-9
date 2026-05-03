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
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");

// ---------------- WEB SERVER ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Cálido running"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});

// ---------------- BOT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ---------------- COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("make")
    .setDescription("Create audio")
    .addSubcommand(sub =>
      sub
        .setName("audio")
        .setDescription("Generate simple audio")
        .addStringOption(opt =>
          opt
            .setName("genre")
            .setDescription("Genre (phonk, pop, rock)")
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Audio tools")
    .addSubcommand(sub =>
      sub
        .setName("bassboost")
        .setDescription("Bass boost an audio file")
        .addAttachmentOption(opt =>
          opt
            .setName("file")
            .setDescription("Upload audio file")
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- SIMPLE AUDIO GENERATOR ----------------
function generateToneWav(filePath, genre) {
  const sampleRate = 44100;
  const duration = 5;
  const samples = sampleRate * duration;

  const buffer = Buffer.alloc(44 + samples * 2);

  function writeString(offset, str) {
    buffer.write(str, offset);
  }

  writeString(0, "RIFF");
  buffer.writeUInt32LE(36 + samples * 2, 4);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  writeString(36, "data");
  buffer.writeUInt32LE(samples * 2, 40);

  let baseFreq = 440;
  if (genre.includes("phonk")) baseFreq = 180;
  if (genre.includes("rock")) baseFreq = 520;
  if (genre.includes("pop")) baseFreq = 660;

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = baseFreq + Math.sin(t * 4) * 80;
    const sample = Math.sin(2 * Math.PI * freq * t);
    buffer.writeInt16LE(sample * 32767, 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ===== /make audio =====
  if (
    interaction.commandName === "make" &&
    interaction.options.getSubcommand() === "audio"
  ) {
    const genre = interaction.options.getString("genre");

    await interaction.deferReply();

    const filePath = path.join(__dirname, "song.wav");

    generateToneWav(filePath, genre.toLowerCase());

    await interaction.editReply({
      content: `Generated ${genre} audio`,
      files: [filePath]
    });

    fs.unlinkSync(filePath);
  }

  // ===== /audio bassboost =====
  if (
    interaction.commandName === "audio" &&
    interaction.options.getSubcommand() === "bassboost"
  ) {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");

    if (!file.contentType || !file.contentType.startsWith("audio")) {
      return interaction.editReply("Upload a valid audio file.");
    }

    const inputPath = path.join(__dirname, "input.mp3");
    const outputPath = path.join(__dirname, "boosted.mp3");

    try {
      // DOWNLOAD FILE
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

      // 🔥 REAL BASS BOOST USING FFMPEG
      const command = `ffmpeg -i "${inputPath}" -af "bass=g=30,volume=1.8" "${outputPath}" -y`;

      exec(command, async (err) => {
        if (err) {
          console.error(err);
          return interaction.editReply("Error processing audio.");
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Bass Boost Complete")
          .setDescription("Your audio has been heavily bass boosted.");

        await interaction.editReply({
          embeds: [embed],
          files: [new AttachmentBuilder(outputPath)]
        });

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });

    } catch (err) {
      console.error(err);
      interaction.editReply("Error processing file.");
    }
  }
});

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Cálido online as ${client.user.tag}`);
});

// ---------------- START ----------------
client.login(TOKEN);
