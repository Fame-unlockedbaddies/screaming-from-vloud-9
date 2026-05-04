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
  PermissionsBitField,
  AuditLogEvent
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const WELCOME_CHANNEL = "1487287724674384032";
const AUTO_ROLE = "1448796463491584060";

const PROTECT_ROLE = "1497843975615283350";
const MUTE_ROLE_ID = "1500698113965428756";

// ================= WEB =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ================= BOT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const protectedUsers = new Set();

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Download music")
    .addSubcommand(s =>
      s.setName("music")
        .setDescription("Download from link")
        .addStringOption(o =>
          o.setName("url").setDescription("Song URL").setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(s =>
      s.setName("edit")
        .setDescription("Enhance audio")
        .addAttachmentOption(o =>
          o.setName("file").setDescription("Audio file").setRequired(true))
        .addBooleanOption(o =>
          o.setName("auto").setDescription("Auto enhance").setRequired(true))
        .addNumberOption(o =>
          o.setName("volume").setDescription("Volume 1-3").setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Bass boost audio")
    .addAttachmentOption(o =>
      o.setName("file").setDescription("Audio").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro")
    .addAttachmentOption(o =>
      o.setName("intro").setDescription("Intro").setRequired(true))
    .addAttachmentOption(o =>
      o.setName("main").setDescription("Main").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addSubcommand(s => s.setName("all").setDescription("Clear channel")),

  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Role panel")
    .addSubcommand(s =>
      s.setName("role-reactions")
        .setDescription("Create panel")
        .addStringOption(o =>
          o.setName("title").setDescription("Title").setRequired(true))
        .addStringOption(o =>
          o.setName("background").setDescription("Image URL").setRequired(true))

        .addRoleOption(o => o.setName("role1").setDescription("Role"))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji"))
        .addStringOption(o => o.setName("name1").setDescription("Name"))

        .addRoleOption(o => o.setName("role2").setDescription("Role"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji"))
        .addStringOption(o => o.setName("name2").setDescription("Name"))

        .addRoleOption(o => o.setName("role3").setDescription("Role"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji"))
        .addStringOption(o => o.setName("name3").setDescription("Name"))

        .addRoleOption(o => o.setName("role4").setDescription("Role"))
        .addStringOption(o => o.setName("emoji4").setDescription("Emoji"))
        .addStringOption(o => o.setName("name4").setDescription("Name"))

        .addRoleOption(o => o.setName("role5").setDescription("Role"))
        .addStringOption(o => o.setName("emoji5").setDescription("Emoji"))
        .addStringOption(o => o.setName("name5").setDescription("Name"))

        .addRoleOption(o => o.setName("role6").setDescription("Role"))
        .addStringOption(o => o.setName("emoji6").setDescription("Emoji"))
        .addStringOption(o => o.setName("name6").setDescription("Name"))

        .addRoleOption(o => o.setName("role7").setDescription("Role"))
        .addStringOption(o => o.setName("emoji7").setDescription("Emoji"))
        .addStringOption(o => o.setName("name7").setDescription("Name"))
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


// ================= PROTECT COMMAND =================
client.on("messageCreate", async message => {
  if (!message.content.startsWith("!calido protect")) return;

  if (!message.member.roles.cache.has(PROTECT_ROLE))
    return message.reply("No permission");

  const user = message.mentions.members.first();
  if (!user) return message.reply("Tag someone");

  protectedUsers.add(user.id);

  message.channel.send(`<@${user.id}> you are being protected by me`);

  user.send(`You are now being protected by calido by ${message.author.tag}`)
    .catch(() => {});
});


// ================= AUTO UNMUTE =================
client.on("guildMemberUpdate", async (oldM, newM) => {
  if (!protectedUsers.has(newM.id)) return;

  try {
    if (newM.communicationDisabledUntilTimestamp) {
      await newM.timeout(null);
    }

    if (newM.roles.cache.has(MUTE_ROLE_ID)) {
      await newM.roles.remove(MUTE_ROLE_ID);
    }

  } catch (e) {
    console.error("Protection error:", e);
  }
});


// ================= ANTI BAN =================
client.on("guildBanAdd", async ban => {
  if (!protectedUsers.has(ban.user.id)) return;

  try {
    const logs = await ban.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 1
    });

    const entry = logs.entries.first();
    const executor = entry?.executor;

    await ban.guild.members.unban(ban.user.id);

    await ban.user.send(
      `this person tried to ban you but you was saved with calido protection!\nmoderator: ${executor?.tag || "unknown"}`
    ).catch(() => {});

  } catch (err) {
    console.error("Anti-ban error:", err);
  }
});


// ================= ANTI KICK =================
client.on("guildMemberRemove", async member => {
  if (!protectedUsers.has(member.id)) return;

  try {
    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry || entry.target.id !== member.id) return;

    const executor = entry.executor;

    const invite = await member.guild.invites.create(
      member.guild.channels.cache.first(),
      { maxUses: 1 }
    );

    await member.user.send(
      `this person tried to kick you but you was saved with calido protection!\nmoderator: ${executor.tag}\nrejoin: ${invite.url}`
    ).catch(() => {});

  } catch (err) {
    console.error("Anti-kick error:", err);
  }
});


// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // DOWNLOAD
  if (interaction.commandName === "download") {
    await interaction.deferReply();
    const url = interaction.options.getString("url");

    exec(`yt-dlp -x --audio-format mp3 -o "song.mp3" "${url}"`, async () => {
      await interaction.editReply({ files: ["song.mp3"] });
      fs.unlinkSync("song.mp3");
    });
  }

  // AUDIO
  if (interaction.commandName === "audio") {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");
    const auto = interaction.options.getBoolean("auto");
    const volume = interaction.options.getNumber("volume");

    const input = "in.mp3";
    const output = "out.mp3";

    const res = await axios({ url: file.url, responseType: "stream" });
    res.data.pipe(fs.createWriteStream(input));
    await new Promise(r => setTimeout(r, 2000));

    const filter = auto
      ? `bass=g=15,acompressor=threshold=-28dB:ratio=9,alimiter=limit=0.98,volume=${volume}`
      : `loudnorm=I=-14,volume=${volume}`;

    exec(`ffmpeg -y -i ${input} -af "${filter}" ${output}`, async () => {
      await interaction.editReply({ files: ["out.mp3"] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // BASSBOOST
  if (interaction.commandName === "bassboost") {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");
    const input = "b1.mp3";
    const output = "b2.mp3";

    const res = await axios({ url: file.url, responseType: "stream" });
    res.data.pipe(fs.createWriteStream(input));
    await new Promise(r => setTimeout(r, 2000));

    exec(`ffmpeg -y -i ${input} -af "bass=g=18,volume=2" ${output}`, async () => {
      await interaction.editReply({ files: ["b2.mp3"] });
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  }

  // ADD INTRO
  if (interaction.commandName === "add") {
    await interaction.deferReply();

    const intro = interaction.options.getAttachment("intro");
    const main = interaction.options.getAttachment("main");

    exec(`ffmpeg -y -i "${intro.url}" -i "${main.url}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" out.mp3`, async () => {
      await interaction.editReply({ files: ["out.mp3"] });
      fs.unlinkSync("out.mp3");
    });
  }

  // PURGE
  if (interaction.commandName === "purge") {
    await interaction.reply({ content: "Clearing...", ephemeral: true });

    let msgs;
    do {
      msgs = await interaction.channel.messages.fetch({ limit: 100 });
      await interaction.channel.bulkDelete(msgs, true);
    } while (msgs.size >= 2);
  }

  // ROLE PANEL
  if (interaction.commandName === "set") {
    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    for (let i = 1; i <= 7; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const emoji = interaction.options.getString(`emoji${i}`);
      const name = interaction.options.getString(`name${i}`);
      if (role && name) roles.push({ role, emoji, name });
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
        .setLabel(r.name)
        .setStyle(ButtonStyle.Secondary);

      if (r.emoji) {
        try { btn.setEmoji(r.emoji.split(" ")[0]); } catch {}
      }

      row.addComponents(btn);
    }

    if (row.components.length) rows.push(row);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.channel.send({ embeds: [embed], components: rows });
    await interaction.reply({ content: "Panel created", ephemeral: true });
  }

  // BUTTON ROLE
  if (interaction.isButton()) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      interaction.reply({ content: "Removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      interaction.reply({ content: "Added", ephemeral: true });
    }
  }

});


// ================= WELCOME =================
client.on("guildMemberAdd", async member => {
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
