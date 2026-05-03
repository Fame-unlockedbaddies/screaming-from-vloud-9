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

// ---------------- COMMANDS ----------------
const commands = [

  // AUDIO EDIT
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
          opt.setName("auto").setDescription("Auto loud TikTok mix").setRequired(true)
        )
    ),

  // ADD INTRO
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

// 🔥 FORCE REGISTER COMMANDS (FIXES /add NOT SHOWING)
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Refreshing commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands loaded.");
  } catch (err) {
    console.error(err);
  }
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Cálido online as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async interaction => {

  // ================= AUDIO =================
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply({ content: "Upload a valid audio file." });
    }

    // ===== AUTO MODE (NEW TIKTOK LOUD) =====
    if (auto) {
      await interaction.deferReply();

      const name = file.url.split("/").pop().split("?")[0] || "audio.mp3";
      const input = path.join(__dirname, "in_" + name);
      const output = path.join(__dirname, name);

      try {
        const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
        const writer = fs.createWriteStream(input);
        res.data.pipe(writer);

        await new Promise((r, j) => {
          writer.on("finish", r);
          writer.on("error", j);
        });

        // 🔥 NEW MATCHING TIKTOK FILTER
        const filter = `
          bass=g=18,
          equalizer=f=90:width_type=o:width=2:g=12,
          equalizer=f=250:width_type=o:width=2:g=-7,
          equalizer=f=2000:width_type=o:width=2:g=9,
          equalizer=f=6000:width_type=o:width=2:g=11,
          treble=g=9,
          acompressor=threshold=-28dB:ratio=7:attack=3:release=70,
          alimiter=limit=0.9,
          volume=2.3
        `.replace(/\s+/g, "");

        const cmd = `ffmpeg -i "${input}" -af "${filter}" -preset ultrafast -b:a 192k "${output}" -y`;

        exec(cmd, async (err) => {
          if (err) {
            console.error(err);
            return interaction.editReply("Error processing.");
          }

          await interaction.editReply({
            content: "TikTok loud audio ready",
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

    // ===== MANUAL =====
    fileCache.set(interaction.user.id, file.url);

    const modal = new ModalBuilder()
      .setCustomId("audioModal")
      .setTitle("Manual Audio");

    const vol = new TextInputBuilder()
      .setCustomId("volume")
      .setLabel("Volume")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const bass = new TextInputBuilder()
      .setCustomId("bass")
      .setLabel("Bass")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(vol),
      new ActionRowBuilder().addComponents(bass)
    );

    return interaction.showModal(modal);
  }

  // ================= ADD =================
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
          content: "Combined audio ready",
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
