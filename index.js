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
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// WEB
const app = express();
app.get("/", (req, res) => res.send("Running"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// COMMANDS
const commands = [

  // AUDIO EDIT
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub.setName("edit")
        .setDescription("Improve audio")
        .addAttachmentOption(o =>
          o.setName("file").setDescription("Audio file").setRequired(true))
        .addBooleanOption(o =>
          o.setName("auto").setDescription("Auto enhance").setRequired(true))
        .addNumberOption(o =>
          o.setName("volume").setDescription("Volume 0.5 - 3").setRequired(true))
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Make audio loud + bass boosted")
    .addAttachmentOption(o =>
      o.setName("file").setDescription("Audio file").setRequired(true)
    ),

  // ADD INTRO
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro to audio")
    .addAttachmentOption(o =>
      o.setName("intro").setDescription("Intro audio").setRequired(true))
    .addAttachmentOption(o =>
      o.setName("main").setDescription("Main audio").setRequired(true)),

  // PURGE
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addSubcommand(sub =>
      sub.setName("all").setDescription("Delete all messages")
    ),

  // ROLE PANEL
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Role panel")
    .addSubcommand(sub =>
      sub.setName("role-reactions")
        .setDescription("Create panel")
        .addStringOption(o =>
          o.setName("title").setDescription("Title").setRequired(true))
        .addStringOption(o =>
          o.setName("background").setDescription("Image URL").setRequired(true))

        .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))
        .addStringOption(o => o.setName("name1").setDescription("Name 1"))

        .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
        .addStringOption(o => o.setName("name2").setDescription("Name 2"))

        .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
        .addStringOption(o => o.setName("name3").setDescription("Name 3"))
    )

].map(c => c.toJSON());

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.once("ready", () => console.log("Bot ready"));

// INTERACTIONS
client.on(Events.InteractionCreate, async interaction => {

  // AUDIO EDIT
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    await interaction.deferReply();

    try {
      const file = interaction.options.getAttachment("file");
      const auto = interaction.options.getBoolean("auto");
      const volume = interaction.options.getNumber("volume");

      const name = file.name;
      const input = "input_" + name;
      const output = name;

      const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
      const writer = fs.createWriteStream(input);
      res.data.pipe(writer);
      await new Promise(r => writer.on("finish", r));

      const filter = auto
        ? `bass=g=18,acompressor=threshold=-28dB:ratio=8,alimiter=limit=0.95,volume=${volume}`
        : `loudnorm=I=-14,volume=${volume}`;

      exec(`ffmpeg -y -i "${input}" -af "${filter}" "${output}"`, async (err) => {
        if (err) return interaction.editReply("Error processing audio");

        await interaction.editReply({
          files: [new AttachmentBuilder(output)]
        });

        fs.unlinkSync(input);
        fs.unlinkSync(output);
      });

    } catch (e) {
      interaction.editReply("Failed.");
    }
  }

  // BASSBOOST
  if (interaction.commandName === "bassboost") {
    await interaction.deferReply();

    try {
      const file = interaction.options.getAttachment("file");
      const name = file.name;

      exec(`ffmpeg -y -i "${file.url}" -af "bass=g=12,volume=1.8" "${name}"`, async (err) => {
        if (err) return interaction.editReply("Error");

        await interaction.editReply({
          files: [new AttachmentBuilder(name)]
        });

        fs.unlinkSync(name);
      });

    } catch {
      interaction.editReply("Failed.");
    }
  }

  // ADD INTRO
  if (interaction.commandName === "add") {
    await interaction.deferReply();

    try {
      const intro = interaction.options.getAttachment("intro");
      const main = interaction.options.getAttachment("main");

      exec(`ffmpeg -y -i "${intro.url}" -i "${main.url}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" output.mp3`, async () => {
        await interaction.editReply({
          files: [new AttachmentBuilder("output.mp3")]
        });
        fs.unlinkSync("output.mp3");
      });

    } catch {
      interaction.editReply("Failed.");
    }
  }

  // PURGE
  if (interaction.commandName === "purge") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    await interaction.reply({ content: "Clearing...", ephemeral: true });

    const channel = interaction.channel;

    let fetched;
    do {
      fetched = await channel.messages.fetch({ limit: 100 });
      const deletable = fetched.filter(m => Date.now() - m.createdTimestamp < 1209600000);
      await channel.bulkDelete(deletable, true);
    } while (fetched.size >= 2);
  }

  // ROLE PANEL
  if (interaction.commandName === "set") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    for (let i = 1; i <= 3; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const emoji = interaction.options.getString(`emoji${i}`);
      const name = interaction.options.getString(`name${i}`);

      if (role && emoji && name) {
        roles.push({ role, emoji, name });
      }
    }

    const row = new ActionRowBuilder();

    roles.forEach(r => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name)
          .setEmoji(r.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply("Done");
  }

  // BUTTONS
  if (interaction.isButton()) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Added", ephemeral: true });
    }
  }

});

client.login(TOKEN);
