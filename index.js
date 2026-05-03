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

// ---------------- CONFIG ----------------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

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

// ---------------- COMMANDS ----------------
const commands = [

  // AUDIO EDIT
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Make audio sound better")
        .addAttachmentOption(o => o.setName("file").setDescription("Audio file").setRequired(true))
        .addBooleanOption(o => o.setName("auto").setDescription("Auto strong mode").setRequired(true))
        .addNumberOption(o =>
          o.setName("volume")
            .setDescription("1.0 - 3.0")
            .setMinValue(0.5)
            .setMaxValue(3.0)
            .setRequired(true)
        )
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Bass boost audio")
    .addAttachmentOption(o => o.setName("file").setDescription("Audio").setRequired(true)),

  // ADD INTRO
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro to audio")
    .addAttachmentOption(o => o.setName("intro").setDescription("Intro audio").setRequired(true))
    .addAttachmentOption(o => o.setName("main").setDescription("Main audio").setRequired(true)),

  // DOWNLOAD MUSIC
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Music info")
    .addSubcommand(sub =>
      sub
        .setName("music")
        .setDescription("Get music from link")
        .addStringOption(o => o.setName("link").setDescription("YouTube or Spotify link").setRequired(true))
    ),

  // ROLE REACTIONS
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Setup systems")
    .addSubcommand(sub =>
      sub
        .setName("role-reactions")
        .setDescription("Create role panel")
        .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
        .addStringOption(o => o.setName("background").setDescription("Image URL").setRequired(true))

        .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1").setRequired(true))
        .addStringOption(o => o.setName("label1").setDescription("Label 1"))

        .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
        .addStringOption(o => o.setName("label2").setDescription("Label 2"))

        .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
        .addStringOption(o => o.setName("label3").setDescription("Label 3"))
    )

].map(c => c.toJSON());

// ---------------- REGISTER COMMANDS (INSTANT) ----------------
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  console.log("Refreshing commands...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [] }
  );

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Commands registered instantly.");
})();

client.once("ready", () => {
  console.log("Cálido running");
});

// ---------------- INTERACTIONS ----------------
client.on(Events.InteractionCreate, async interaction => {

  // AUDIO EDIT
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");
    const volume = interaction.options.getNumber("volume");

    if (!file.contentType?.startsWith("audio")) {
      return interaction.reply("Upload a valid audio file.");
    }

    await interaction.deferReply();

    const name = file.url.split("/").pop().split("?")[0];
    const input = "in_" + name;
    const output = name;

    const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(input);
    res.data.pipe(writer);
    await new Promise(r => writer.on("finish", r));

    const filter = auto
      ? `bass=g=18,acompressor=threshold=-28dB:ratio=7,alimiter=limit=0.9,volume=${volume}`
      : `loudnorm=I=-14,bass=g=3,volume=${volume}`;

    exec(`ffmpeg -i "${input}" -af "${filter}" "${output}" -y`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder(output)] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // BASSBOOST
  if (interaction.commandName === "bassboost") {
    const file = interaction.options.getAttachment("file");

    await interaction.deferReply();

    const name = file.url.split("/").pop();
    exec(`ffmpeg -i "${file.url}" -af "bass=g=10,volume=1.6" "${name}" -y`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder(name)] });
    });
  }

  // ADD INTRO
  if (interaction.commandName === "add") {
    const intro = interaction.options.getAttachment("intro");
    const main = interaction.options.getAttachment("main");

    await interaction.deferReply();

    exec(`ffmpeg -i "${intro.url}" -i "${main.url}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" output.mp3 -y`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder("output.mp3")] });
    });
  }

  // DOWNLOAD
  if (interaction.commandName === "download") {
    const link = interaction.options.getString("link");
    await interaction.deferReply();

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

  // ROLE PANEL
  if (interaction.commandName === "set" && interaction.options.getSubcommand() === "role-reactions") {

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [
      { role: interaction.options.getRole("role1"), emoji: interaction.options.getString("emoji1"), label: interaction.options.getString("label1") || "Role 1" },
      { role: interaction.options.getRole("role2"), emoji: interaction.options.getString("emoji2"), label: interaction.options.getString("label2") || "Role 2" },
      { role: interaction.options.getRole("role3"), emoji: interaction.options.getString("emoji3"), label: interaction.options.getString("label3") || "Role 3" }
    ].filter(r => r.role && r.emoji);

    const row = new ActionRowBuilder();

    roles.forEach(r => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.label)
          .setEmoji(r.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // BUTTON ROLES
  if (interaction.isButton() && interaction.customId.startsWith("role_")) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Role removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Role added", ephemeral: true });
    }
  }

});

// ---------------- !LIST ----------------
client.on("messageCreate", async message => {
  if (!message.content.startsWith("!list")) return;

  if (!message.member.roles.cache.has("1500517540273590525")) return;

  const target = message.mentions.members.first();
  if (!target) return;

  await target.roles.add("1500517783480569936");
  await target.send(`You got Cálido premium from ${message.author.tag}`);
});

// ---------------- WELCOME ----------------
client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.get("1487287724674384032");
  if (!channel) return;

  await member.roles.add("1448796463491584060").catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
    .setDescription(`You're member **#${member.guild.memberCount}**`)
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  channel.send({
    content: `Welcome <@${member.id}>!`,
    embeds: [embed]
  });
});

// ---------------- START ----------------
client.login(TOKEN);
