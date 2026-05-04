console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Events,
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

// ================= EXPRESS =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ================= CLIENT =================
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
    .addStringOption(o =>
      o.setName("url").setDescription("Song URL").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Enhance audio")
    .addAttachmentOption(o =>
      o.setName("file").setDescription("Audio").setRequired(true))
    .addBooleanOption(o =>
      o.setName("auto").setDescription("Auto").setRequired(true))
    .addNumberOption(o =>
      o.setName("volume").setDescription("1-3").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete all messages"),

  new SlashCommandBuilder()
    .setName("role-reactions")
    .setDescription("Create role panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("background").setDescription("Image URL").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role"))
    .addStringOption(o => o.setName("emoji1").setDescription("Emoji"))
    .addStringOption(o => o.setName("name1").setDescription("Name"))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addStringOption(o => o.setName("emoji2").setDescription("Emoji"))
    .addStringOption(o => o.setName("name2").setDescription("Name"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))
    .addStringOption(o => o.setName("emoji3").setDescription("Emoji"))
    .addStringOption(o => o.setName("name3").setDescription("Name"))

].map(c => c.toJSON());

// REGISTER COMMANDS
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Commands registered");
  } catch (err) {
    console.error(err);
  }
});

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= TRANSLATION =================
client.on("messageCreate", async msg => {
  if (msg.author.bot || msg.content.length < 5) return;

  try {
    const res = await axios.get("https://api.mymemory.translated.net/get", {
      params: { q: msg.content, langpair: "auto|en" }
    });

    const t = res.data.responseData.translatedText;
    if (!t || t.toLowerCase() === msg.content.toLowerCase()) return;

    msg.reply(`🌍 ${t}`);
  } catch {}
});

// ================= PROTECTION =================
client.on("messageCreate", async msg => {

  if (msg.content.startsWith("!calido protect")) {
    if (!msg.member.roles.cache.has(PROTECT_ROLE)) return;

    const user = msg.mentions.members.first();
    if (!user) return;

    protectedUsers.add(user.id);
    msg.channel.send(`<@${user.id}> is now protected`);

    user.send(`You are protected by ${msg.author.tag}`).catch(() => {});
  }

  if (msg.content.startsWith("!calido unprotect")) {
    if (!msg.member.roles.cache.has(PROTECT_ROLE)) return;

    const user = msg.mentions.users.first();
    if (!user) return;

    protectedUsers.delete(user.id);
    msg.reply("Unprotected");
  }

});

// ================= AUTO UNMUTE =================
client.on("guildMemberUpdate", async (o, n) => {
  if (!protectedUsers.has(n.id)) return;

  try {
    if (n.communicationDisabledUntilTimestamp) await n.timeout(null);
    if (n.roles.cache.has(MUTE_ROLE_ID)) await n.roles.remove(MUTE_ROLE_ID);
  } catch {}
});

// ================= BAN / KICK PROTECT =================
client.on("guildBanAdd", async ban => {
  if (!protectedUsers.has(ban.user.id)) return;

  await ban.guild.members.unban(ban.user.id);
  const invite = await ban.guild.invites.create(ban.guild.channels.cache.first(), { maxUses: 1 });

  ban.user.send(`Saved from ban\nJoin: ${invite.url}`).catch(() => {});
});

client.on("guildMemberRemove", async member => {
  if (!protectedUsers.has(member.id)) return;

  const invite = await member.guild.invites.create(member.guild.channels.cache.first(), { maxUses: 1 });

  member.user.send(`Saved from kick\nJoin: ${invite.url}`).catch(() => {});
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  if (!i.isChatInputCommand()) return;

  // DOWNLOAD
  if (i.commandName === "download") {
    await i.deferReply();

    exec(`yt-dlp -x --audio-format mp3 -o song.mp3 "${i.options.getString("url")}"`, async err => {
      if (err) return i.editReply("Download failed");

      await i.editReply({ files: ["song.mp3"] });
      fs.unlinkSync("song.mp3");
    });
  }

  // AUDIO
  if (i.commandName === "audio") {
    await i.deferReply();

    const file = i.options.getAttachment("file");
    const auto = i.options.getBoolean("auto");
    const volume = i.options.getNumber("volume");

    const res = await axios({ url: file.url, responseType: "stream" });
    res.data.pipe(fs.createWriteStream("in.mp3"));

    setTimeout(() => {
      const filter = auto ? `bass=g=15,volume=${volume}` : `volume=${volume}`;

      exec(`ffmpeg -y -i in.mp3 -af "${filter}" out.mp3`, async err => {
        if (err) return i.editReply("ffmpeg missing");

        await i.editReply({ files: ["out.mp3"] });
        fs.unlinkSync("in.mp3");
        fs.unlinkSync("out.mp3");
      });
    }, 2000);
  }

  // PURGE
  if (i.commandName === "purge") {
    await i.reply({ content: "Clearing...", ephemeral: true });

    let msgs;
    do {
      msgs = await i.channel.messages.fetch({ limit: 100 });
      await i.channel.bulkDelete(msgs, true);
    } while (msgs.size >= 2);
  }

  // ROLE PANEL
  if (i.commandName === "role-reactions") {

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(i.options.getString("title"))
      .setImage(i.options.getString("background"));

    const row = new ActionRowBuilder();

    for (let x = 1; x <= 3; x++) {
      const role = i.options.getRole(`role${x}`);
      const emoji = i.options.getString(`emoji${x}`);
      const name = i.options.getString(`name${x}`);

      if (!role || !name) continue;

      const btn = new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(name)
        .setStyle(ButtonStyle.Secondary);

      if (emoji) btn.setEmoji(emoji);

      row.addComponents(btn);
    }

    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: "done", ephemeral: true });
  }

  // BUTTON ROLE
  if (i.isButton()) {
    const roleId = i.customId.split("_")[1];

    if (i.member.roles.cache.has(roleId)) {
      await i.member.roles.remove(roleId);
      i.reply({ content: "removed", ephemeral: true });
    } else {
      await i.member.roles.add(roleId);
      i.reply({ content: "added", ephemeral: true });
    }
  }

});

// ================= WELCOME =================
client.on("guildMemberAdd", async m => {

  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!ch) return;

  await m.roles.add(AUTO_ROLE).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${m.id}> | Member #${m.guild.memberCount}`)
    .setThumbnail(m.user.displayAvatarURL())
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  ch.send({ embeds: [embed] });
});

// ================= LOGIN =================
client.login(TOKEN).catch(console.error);
