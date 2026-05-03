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

// ---------------- COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Audio tools")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Make audio loud (TikTok style)")
        .addAttachmentOption(opt =>
          opt.setName("file").setDescription("Upload audio").setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName("auto").setDescription("Auto loud mix").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro audio to main audio")
    .addAttachmentOption(opt =>
      opt.setName("intro").setDescription("Intro audio").setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName("main").setDescription("Main audio").setRequired(true)
    )

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// REGISTER COMMANDS
(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Cálido online`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async interaction => {

  // ===== AUDIO COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply({ content: "Upload a valid audio file." });
    }

    if (auto) {
      await interaction.deferReply();

      const name = file.url.split("/").pop().split("?")[0] || "audio.mp3";
      const input = "input_" + name;
      const output = name;

      try {
        // download
        const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
        const writer = fs.createWriteStream(input);
        res.data.pipe(writer);

        await new Promise((r, j) => {
          writer.on("finish", r);
          writer.on("error", j);
        });

        // 🔥 FULL LOUD FILTER (ENTIRE SONG BOOSTED)
        const filter = `
          loudnorm=I=-5:TP=-1:LRA=4,
          acompressor=threshold=-30dB:ratio=8:attack=5:release=50,
          bass=g=14,
          equalizer=f=120:width_type=o:width=2:g=8,
          equalizer=f=300:width_type=o:width=2:g=-5,
          equalizer=f=2500:width_type=o:width=2:g=6,
          equalizer=f=6000:width_type=o:width=2:g=8,
          treble=g=7,
          alimiter=limit=0.95,
          volume=2.2
        `.replace(/\s+/g, "");

        const cmd = `ffmpeg -i "${input}" -af "${filter}" -preset ultrafast -b:a 192k "${output}" -y`;

        exec(cmd, async (err) => {
          if (err) {
            console.error(err);
            return interaction.editReply("Error processing audio.");
          }

          await interaction.editReply({
            content: "Fully loud TikTok-style audio ready",
            files: [new AttachmentBuilder(output)]
          });

          fs.unlinkSync(input);
          fs.unlinkSync(output);
        });

      } catch (e) {
        console.error(e);
        interaction.editReply("Failed.");
      }

      return;
    }
  }

  // ===== ADD COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === "add") {
    await interaction.deferReply();

    const intro = interaction.options.getAttachment("intro");
    const main = interaction.options.getAttachment("main");

    if (!intro.contentType?.startsWith("audio") || !main.contentType?.startsWith("audio")) {
      return interaction.editReply("Both must be audio.");
    }

    const introPath = "intro.mp3";
    const mainPath = "main.mp3";
    const output = "combined.mp3";

    try {
      const r1 = await axios({ url: intro.url, method: "GET", responseType: "stream" });
      const w1 = fs.createWriteStream(introPath);
      r1.data.pipe(w1);
      await new Promise((r, j) => { w1.on("finish", r); w1.on("error", j); });

      const r2 = await axios({ url: main.url, method: "GET", responseType: "stream" });
      const w2 = fs.createWriteStream(mainPath);
      r2.data.pipe(w2);
      await new Promise((r, j) => { w2.on("finish", r); w2.on("error", j); });

      const cmd = `ffmpeg -i "${introPath}" -i "${mainPath}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" -preset ultrafast "${output}" -y`;

      exec(cmd, async () => {
        await interaction.editReply({
          content: "Audio combined",
          files: [new AttachmentBuilder(output)]
        });

        fs.unlinkSync(introPath);
        fs.unlinkSync(mainPath);
        fs.unlinkSync(output);
      });

    } catch {
      interaction.editReply("Error combining.");
    }
  }

});

// ---------------- START ----------------
client.login(TOKEN);
