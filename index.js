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
        .setDescription("Improve audio")
        .addAttachmentOption(o =>
          o.setName("file").setDescription("Audio file").setRequired(true)
        )
        .addBooleanOption(o =>
          o.setName("auto").setDescription("Auto mode").setRequired(true)
        )
        .addNumberOption(o =>
          o.setName("volume").setDescription("Volume").setMinValue(0.5).setMaxValue(3).setRequired(true)
        )
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Bass boost")
    .addAttachmentOption(o =>
      o.setName("file").setDescription("Audio file").setRequired(true)
    ),

  // ADD INTRO
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro")
    .addAttachmentOption(o =>
      o.setName("intro").setDescription("Intro audio").setRequired(true)
    )
    .addAttachmentOption(o =>
      o.setName("main").setDescription("Main audio").setRequired(true)
    ),

  // DOWNLOAD
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Music info")
    .addSubcommand(sub =>
      sub
        .setName("music")
        .setDescription("Get info")
        .addStringOption(o =>
          o.setName("link").setDescription("URL").setRequired(true)
        )
    ),

  // ROLE BUTTON SYSTEM (CUSTOM)
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Setup systems")
    .addSubcommand(sub =>
      sub
        .setName("role-reactions")
        .setDescription("Create role panel")

        .addStringOption(o =>
          o.setName("title").setDescription("Panel title").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("background").setDescription("Image URL").setRequired(true)
        )

        // ROLE 1
        .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji").setRequired(true))
        .addStringOption(o => o.setName("name1").setDescription("Button name").setRequired(true))

        // ROLE 2
        .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji"))
        .addStringOption(o => o.setName("name2").setDescription("Button name"))

        // ROLE 3
        .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji"))
        .addStringOption(o => o.setName("name3").setDescription("Button name"))

        // ROLE 4
        .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
        .addStringOption(o => o.setName("emoji4").setDescription("Emoji"))
        .addStringOption(o => o.setName("name4").setDescription("Button name"))

        // ROLE 5
        .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
        .addStringOption(o => o.setName("emoji5").setDescription("Emoji"))
        .addStringOption(o => o.setName("name5").setDescription("Button name"))
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

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("Music")
      .setDescription(link);

    await interaction.reply({ embeds: [embed] });
  }

  // ROLE BUTTON PANEL
  if (
    interaction.commandName === "set" &&
    interaction.options.getSubcommand() === "role-reactions"
  ) {

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    for (let i = 1; i <= 5; i++) {
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

    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.editReply("Panel created");
  }

  // BUTTON ROLE HANDLER
  if (interaction.isButton()) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Removed role", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Added role", ephemeral: true });
    }
  }

});

// !LIST
client.on("messageCreate", async message => {
  if (!message.content.startsWith("!list")) return;
  if (!message.member.roles.cache.has("1500517540273590525")) return;

  const user = message.mentions.members.first();
  if (!user) return;

  await user.roles.add("1500517783480569936");
  await user.send(`You got premium from ${message.author.tag}`);
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
