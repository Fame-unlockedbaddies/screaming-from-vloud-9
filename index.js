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
  AttachmentBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
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
        .addBooleanOption(opt =>
          opt.setName("auto").setDescription("Stronger sound").setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName("volume")
            .setDescription("Final loudness (1.0 - 3.0)")
            .setMinValue(0.5)
            .setMaxValue(3.0)
            .setRequired(true)
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
    ),

  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Get music info")
    .addSubcommand(sub =>
      sub
        .setName("music")
        .setDescription("Get info from a link")
        .addStringOption(opt =>
          opt.setName("link").setDescription("YouTube or Spotify link").setRequired(true)
        )
    )

].map(c => c.toJSON());

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

client.once("ready", () => {
  console.log("Cálido running");
});

// ---------------- INTERACTIONS ----------------
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");
    const volume = interaction.options.getNumber("volume");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply("Upload an audio file.");
    }

    await interaction.deferReply();

    const name = file.url.split("/").pop().split("?")[0] || "audio.mp3";
    const input = "in_" + name;
    const output = name;

    const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(input);
    res.data.pipe(writer);
    await new Promise(r => writer.on("finish", r));

    const filter = auto
      ? `bass=g=18,equalizer=f=90:width_type=o:width=2:g=12,acompressor=threshold=-28dB:ratio=7,alimiter=limit=0.9,volume=${volume}`
      : `loudnorm=I=-14,acompressor=threshold=-20dB:ratio=2,bass=g=3,volume=${volume}`;

    exec(`ffmpeg -i "${input}" -af "${filter}" "${output}" -y`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder(output)] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // DOWNLOAD
  if (interaction.commandName === "download") {
    const link = interaction.options.getString("link");

    await interaction.deferReply();

    if (link.includes("youtube.com") || link.includes("youtu.be")) {
      const id = link.split("v=")[1]?.split("&")[0] || link.split("/").pop();

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("Music")
        .setDescription(link)
        .setImage(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`);

      const button = new ButtonBuilder()
        .setLabel("Open")
        .setStyle(ButtonStyle.Link)
        .setURL(link);

      return interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)]
      });
    }

    interaction.editReply("Invalid link.");
  }

});

// ---------------- !LIST ----------------
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!list")) return;

  const REQUIRED_ROLE = "1500517540273590525";
  const PREMIUM_ROLE = "1500517783480569936";

  if (!message.member.roles.cache.has(REQUIRED_ROLE)) return;

  const target = message.mentions.members.first();
  if (!target) return;

  await target.roles.add(PREMIUM_ROLE);

  await target.send(
    `You have earned Cálido premium by ${message.author.tag}! You are now premium.`
  );
});

// ---------------- WELCOME ----------------
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get("1487287724674384032");
  const roleId = "1448796463491584060";

  if (!channel) return;

  try {
    await member.roles.add(roleId);
  } catch {}

  const avatar = member.user.displayAvatarURL({ dynamic: true, size: 1024 });
  const count = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`You're member **#${count}**`)
    .setThumbnail(avatar)
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  channel.send({
    content: `Welcome <@${member.id}>!`,
    embeds: [embed]
  });
});

// ---------------- START ----------------
client.login(TOKEN);
