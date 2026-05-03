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
  StringSelectMenuBuilder
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// COMMANDS
const commands = [

  // AUDIO EDIT
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Make audio sound better")
        .addAttachmentOption(o => o.setName("file").setRequired(true))
        .addBooleanOption(o => o.setName("auto").setRequired(true))
        .addNumberOption(o => o.setName("volume").setMinValue(0.5).setMaxValue(3).setRequired(true))
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Bass boost audio")
    .addAttachmentOption(o => o.setName("file").setRequired(true)),

  // ADD INTRO
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro to audio")
    .addAttachmentOption(o => o.setName("intro").setRequired(true))
    .addAttachmentOption(o => o.setName("main").setRequired(true)),

  // DOWNLOAD
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Music info")
    .addSubcommand(sub =>
      sub
        .setName("music")
        .setDescription("Get info from link")
        .addStringOption(o => o.setName("link").setRequired(true))
    ),

  // ROLE SYSTEM (100)
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Setup systems")
    .addSubcommand(sub =>
      sub
        .setName("role-reactions")
        .setDescription("Create role menu (100 roles)")
        .addStringOption(o => o.setName("title").setRequired(true))
        .addStringOption(o => o.setName("background").setRequired(true))
    )

].map(c => c.toJSON());

// REGISTER (NO DUPES)
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Commands ready");
})();

client.once("ready", () => console.log("Bot online"));

// INTERACTIONS
client.on(Events.InteractionCreate, async interaction => {

  // AUDIO EDIT
  if (interaction.isChatInputCommand() && interaction.commandName === "audio") {
    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");
    const volume = interaction.options.getNumber("volume");

    await interaction.deferReply();

    const name = file.url.split("/").pop();
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

    return interaction.editReply({ embeds: [embed] });
  }

  // ROLE SYSTEM (100 DROPDOWN)
  if (interaction.commandName === "set") {

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = interaction.guild.roles.cache
      .filter(r => r.name !== "@everyone")
      .map(r => r)
      .slice(0, 100);

    const rows = [];
    for (let i = 0; i < roles.length; i += 25) {
      const chunk = roles.slice(i, i + 25);

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`roles_${i}`)
        .setPlaceholder(`Roles ${i + 1}-${i + chunk.length}`)
        .setMinValues(0)
        .setMaxValues(chunk.length)
        .addOptions(chunk.map(role => ({
          label: role.name,
          value: role.id
        })));

      rows.push(new ActionRowBuilder().addComponents(menu));
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.channel.send({
      embeds: [embed],
      components: rows
    });

    await interaction.editReply("Done");
  }

  // HANDLE ROLE SELECT
  if (interaction.isStringSelectMenu()) {
    const member = interaction.member;
    const selected = interaction.values;
    const all = interaction.component.options.map(o => o.value);

    for (const roleId of all) {
      if (member.roles.cache.has(roleId) && !selected.includes(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
      }
    }

    for (const roleId of selected) {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(() => {});
      }
    }

    await interaction.reply({ content: "Roles updated", ephemeral: true });
  }

});

// !LIST
client.on("messageCreate", async message => {
  if (!message.content.startsWith("!list")) return;
  if (!message.member.roles.cache.has("1500517540273590525")) return;

  const user = message.mentions.members.first();
  if (!user) return;

  await user.roles.add("1500517783480569936");
  await user.send(`You have earned premium from ${message.author.tag}`);
});

// WELCOME
client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.get("1487287724674384032");
  if (!channel) return;

  await member.roles.add("1448796463491584060").catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setThumbnail(member.user.displayAvatarURL())
    .setDescription(`Member #${member.guild.memberCount}`)
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

client.login(TOKEN);
