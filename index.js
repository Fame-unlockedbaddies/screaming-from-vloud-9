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
  Events
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const WELCOME_CHANNEL = "1487287724674384032";
const AUTO_ROLE = "1448796463491584060";

const PROTECT_ROLE = "1497843975615283350";
const MUTE_ROLE_ID = "1500698113965428756";

// ================= KEEP ALIVE (RENDER) =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server ready");
});

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
    .addStringOption(o => o.setName("title").setRequired(true))
    .addStringOption(o => o.setName("background").setRequired(true))
    .addRoleOption(o => o.setName("role1"))
    .addStringOption(o => o.setName("emoji1"))
    .addStringOption(o => o.setName("name1"))
    .addRoleOption(o => o.setName("role2"))
    .addStringOption(o => o.setName("emoji2"))
    .addStringOption(o => o.setName("name2"))
    .addRoleOption(o => o.setName("role3"))
    .addStringOption(o => o.setName("emoji3"))
    .addStringOption(o => o.setName("name3"))

].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered");
  } catch (err) {
    console.error(err);
  }
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= ROLE BUTTON HANDLER =================
client.on(Events.InteractionCreate, async i => {

  // 🔘 BUTTONS FIRST (IMPORTANT FIX)
  if (i.isButton()) {
    const roleId = i.customId.split("_")[1];

    try {
      const role = i.guild.roles.cache.get(roleId);
      if (!role) {
        return i.reply({ content: "Role not found", ephemeral: true });
      }

      if (i.member.roles.cache.has(roleId)) {
        await i.member.roles.remove(roleId);
        await i.reply({ content: "Role removed", ephemeral: true });
      } else {
        await i.member.roles.add(roleId);
        await i.reply({ content: "Role added", ephemeral: true });
      }

    } catch (err) {
      console.error(err);
      await i.reply({ content: "Failed (check role permissions)", ephemeral: true });
    }

    return;
  }

  // ================= SLASH COMMANDS =================
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

    const writer = fs.createWriteStream("in.mp3");
    const res = await axios({ url: file.url, responseType: "stream" });

    res.data.pipe(writer);

    writer.on("finish", () => {
      const filter = auto ? `bass=g=15,volume=${volume}` : `volume=${volume}`;

      exec(`ffmpeg -y -i in.mp3 -af "${filter}" out.mp3`, async err => {
        if (err) return i.editReply("ffmpeg missing");

        await i.editReply({ files: ["out.mp3"] });

        fs.unlinkSync("in.mp3");
        fs.unlinkSync("out.mp3");
      });
    });
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

});

// ================= AUTO ROLE =================
client.on("guildMemberAdd", async m => {
  try {
    await m.roles.add(AUTO_ROLE);
  } catch (e) {
    console.error("Auto role failed:", e);
  }

  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${m.id}> | Member #${m.guild.memberCount}`)
    .setThumbnail(m.user.displayAvatarURL());

  ch.send({ embeds: [embed] });
});

// ================= LOGIN =================
client.login(TOKEN);
