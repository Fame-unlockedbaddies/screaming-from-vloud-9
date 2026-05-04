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

const WELCOME_CHANNEL = "1487287724674384032";
const AUTO_ROLE = "1448796463491584060";

// WEB SERVER
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});


// ================= COMMANDS =================

const commands = [

  // DOWNLOAD
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Download music")
    .addSubcommand(sub =>
      sub.setName("music")
        .setDescription("Download from YouTube or Spotify")
        .addStringOption(o =>
          o.setName("url").setDescription("Song URL").setRequired(true)
        )
    ),

  // AUDIO EDIT
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub.setName("edit")
        .setDescription("Enhance audio")
        .addAttachmentOption(o =>
          o.setName("file").setDescription("Audio file").setRequired(true))
        .addBooleanOption(o =>
          o.setName("auto").setDescription("Auto enhance").setRequired(true))
        .addNumberOption(o =>
          o.setName("volume").setDescription("Volume (1-3)").setRequired(true))
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Boost bass + loud")
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
      sub.setName("all").setDescription("Clear channel")
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

        .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
        .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))
        .addStringOption(o => o.setName("name4").setDescription("Name 4"))

        .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
        .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))
        .addStringOption(o => o.setName("name5").setDescription("Name 5"))

        .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
        .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))
        .addStringOption(o => o.setName("name6").setDescription("Name 6"))

        .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
        .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))
        .addStringOption(o => o.setName("name7").setDescription("Name 7"))
    )

].map(c => c.toJSON());


// REGISTER COMMANDS
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.once("ready", () => console.log("Bot ready"));


// ================= INTERACTIONS =================

client.on(Events.InteractionCreate, async interaction => {

  // DOWNLOAD
  if (interaction.isChatInputCommand() && interaction.commandName === "download") {
    await interaction.deferReply();

    const url = interaction.options.getString("url");
    const file = `song_${Date.now()}.mp3`;

    exec(`yt-dlp -x --audio-format mp3 --no-playlist -o "${file}" "${url}"`, async (err) => {
      if (err) return interaction.editReply("Download failed");

      await interaction.editReply({
        files: [new AttachmentBuilder(file)]
      });

      fs.unlinkSync(file);
    });
  }

  // AUDIO EDIT
  if (interaction.commandName === "audio") {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");
    const volume = interaction.options.getNumber("volume");

    const input = "input.mp3";
    const output = "output.mp3";

    const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(input);
    res.data.pipe(writer);
    await new Promise(r => writer.on("finish", r));

    const filter = auto
      ? `bass=g=15,acompressor=threshold=-28dB:ratio=9,alimiter=limit=0.98,volume=${volume}`
      : `loudnorm=I=-14,volume=${volume}`;

    exec(`ffmpeg -y -i ${input} -af "${filter}" ${output}`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder(output)] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // BASSBOOST
  if (interaction.commandName === "bassboost") {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");
    const input = "bass_in.mp3";
    const output = "bass_out.mp3";

    const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(input);
    res.data.pipe(writer);
    await new Promise(r => writer.on("finish", r));

    exec(`ffmpeg -y -i ${input} -af "bass=g=18,volume=2" ${output}`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder(output)] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // ADD INTRO
  if (interaction.commandName === "add") {
    await interaction.deferReply();

    const intro = interaction.options.getAttachment("intro");
    const main = interaction.options.getAttachment("main");

    exec(`ffmpeg -y -i "${intro.url}" -i "${main.url}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" output.mp3`, async () => {
      await interaction.editReply({ files: [new AttachmentBuilder("output.mp3")] });
      fs.unlinkSync("output.mp3");
    });
  }

  // PURGE
  if (interaction.commandName === "purge") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    await interaction.reply({ content: "Clearing...", ephemeral: true });

    let fetched;
    do {
      fetched = await interaction.channel.messages.fetch({ limit: 100 });
      const deletable = fetched.filter(m => Date.now() - m.createdTimestamp < 1209600000);
      await interaction.channel.bulkDelete(deletable, true);
    } while (fetched.size >= 2);
  }

  // ROLE PANEL (FINAL FIX)
  if (interaction.commandName === "set") {
    try {
      const title = interaction.options.getString("title");
      const bg = interaction.options.getString("background");

      const roles = [];

      for (let i = 1; i <= 7; i++) {
        const role = interaction.options.getRole(`role${i}`);
        const emoji = interaction.options.getString(`emoji${i}`);
        const name = interaction.options.getString(`name${i}`);

        if (role && name) roles.push({ role, emoji, name });
      }

      if (!roles.length) {
        return interaction.reply({ content: "Add at least 1 role", ephemeral: true });
      }

      const rows = [];
      let row = new ActionRowBuilder();

      for (const r of roles) {
        if (row.components.length === 5) {
          rows.push(row);
          row = new ActionRowBuilder();
        }

        const btn = new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name.substring(0, 80))
          .setStyle(ButtonStyle.Secondary);

        if (r.emoji) {
          try { btn.setEmoji(r.emoji.trim().split(" ")[0]); } catch {}
        }

        row.addComponents(btn);
      }

      if (row.components.length) rows.push(row);

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(title.substring(0, 256));

      if (bg && bg.startsWith("http")) embed.setImage(bg);

      await interaction.channel.send({
        embeds: [embed],
        components: rows
      });

      await interaction.reply({
        content: "Panel created",
        ephemeral: true
      });

    } catch (err) {
      console.error("ROLE PANEL ERROR:", err);

      interaction.reply({
        content: `Error: ${err.message}`,
        ephemeral: true
      });
    }
  }

  // BUTTON HANDLER
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


// ================= WELCOME =================

const welcomed = new Set();

client.on("guildMemberAdd", async member => {
  if (welcomed.has(member.id)) return;
  welcomed.add(member.id);

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!channel) return;

  await member.roles.add(AUTO_ROLE).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${member.id}>!\nMember #${member.guild.memberCount}`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  channel.send({ embeds: [embed] });
});

client.login(TOKEN);
