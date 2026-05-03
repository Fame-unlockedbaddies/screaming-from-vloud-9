process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require("discord.js");

// ---------------- WEB ----------------
const app = express();
app.get("/", (req, res) => res.send("Cálido running"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// ---------------- BOT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ---------------- COMMANDS ----------------
const commands = [

  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Make the audio sound better")
        .addAttachmentOption(opt =>
          opt.setName("file").setDescription("Audio file").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Add bass to audio")
    .addAttachmentOption(opt =>
      opt.setName("file").setDescription("Audio file").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro to audio")
    .addAttachmentOption(opt =>
      opt.setName("intro").setDescription("Intro audio").setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName("main").setDescription("Main audio").setRequired(true)
    )

].map(c => c.toJSON());

// REGISTER COMMANDS
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log("Cálido running");
});

// ---------------- SLASH COMMANDS ----------------
client.on(Events.InteractionCreate, async interaction => {

  // ===== AUDIO EDIT =====
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply("Upload an audio file.");
    }

    await interaction.deferReply();

    const name = file.url.split("/").pop().split("?")[0] || "audio.mp3";
    const input = "in_" + name;
    const output = name;

    try {
      const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
      const writer = fs.createWriteStream(input);
      res.data.pipe(writer);

      await new Promise((r, j) => {
        writer.on("finish", r);
        writer.on("error", j);
      });

      const filter = `
        loudnorm=I=-14:TP=-1.5:LRA=10,
        acompressor=threshold=-20dB:ratio=2:attack=30:release=300,
        equalizer=f=250:width_type=o:width=2:g=-2,
        equalizer=f=3000:width_type=o:width=2:g=2,
        equalizer=f=5000:width_type=o:width=2:g=2,
        bass=g=3,
        treble=g=1,
        alimiter=limit=0.95,
        volume=1.2
      `.replace(/\s+/g, "");

      const cmd = `ffmpeg -i "${input}" -af "${filter}" -preset ultrafast -b:a 192k "${output}" -y`;

      exec(cmd, async () => {
        await interaction.editReply({
          files: [new AttachmentBuilder(output)]
        });

        fs.unlinkSync(input);
        fs.unlinkSync(output);
      });

    } catch {
      interaction.editReply("Failed");
    }
  }

  // ===== BASSBOOST =====
  if (interaction.isChatInputCommand() && interaction.commandName === "bassboost") {
    const file = interaction.options.getAttachment("file");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply("Upload an audio file.");
    }

    await interaction.deferReply();

    const name = file.url.split("/").pop().split("?")[0] || "audio.mp3";
    const input = "in_" + name;
    const output = name;

    try {
      const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
      const writer = fs.createWriteStream(input);
      res.data.pipe(writer);

      await new Promise((r, j) => {
        writer.on("finish", r);
        writer.on("error", j);
      });

      const filter = `
        loudnorm=I=-13:TP=-1.5:LRA=9,
        acompressor=threshold=-18dB:ratio=2.5:attack=25:release=250,
        equalizer=f=80:width_type=o:width=2:g=4,
        equalizer=f=120:width_type=o:width=2:g=3,
        bass=g=5,
        alimiter=limit=0.95,
        volume=1.3
      `.replace(/\s+/g, "");

      const cmd = `ffmpeg -i "${input}" -af "${filter}" -preset ultrafast -b:a 192k "${output}" -y`;

      exec(cmd, async () => {
        await interaction.editReply({
          files: [new AttachmentBuilder(output)]
        });

        fs.unlinkSync(input);
        fs.unlinkSync(output);
      });

    } catch {
      interaction.editReply("Failed");
    }
  }

  // ===== ADD INTRO =====
  if (interaction.isChatInputCommand() && interaction.commandName === "add") {
    await interaction.deferReply();

    const intro = interaction.options.getAttachment("intro");
    const main = interaction.options.getAttachment("main");

    if (!intro.contentType?.startsWith("audio") || !main.contentType?.startsWith("audio")) {
      return interaction.editReply("Both must be audio files.");
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
          files: [new AttachmentBuilder(output)]
        });

        fs.unlinkSync(introPath);
        fs.unlinkSync(mainPath);
        fs.unlinkSync(output);
      });

    } catch {
      interaction.editReply("Error");
    }
  }

});

// ---------------- MESSAGE COMMAND (!list) ----------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (!message.content.startsWith("!list")) return;

  const REQUIRED_ROLE = "1500517540273590525";
  const PREMIUM_ROLE = "1500517783480569936";

  if (!message.member.roles.cache.has(REQUIRED_ROLE)) {
    return message.reply("You can't use this.");
  }

  const target = message.mentions.members.first();
  if (!target) return message.reply("Mention a user.");

  try {
    await target.roles.add(PREMIUM_ROLE);

    await target.send(
      `You have earned Cálido premium by ${message.author.tag}! You are now a premium user, enjoy the benefits babes x!`
    );

    message.reply(`${target.user.tag} is now premium.`);
  } catch (err) {
    console.error(err);
    message.reply("Error.");
  }
});

// ---------------- START ----------------
client.login(TOKEN);
