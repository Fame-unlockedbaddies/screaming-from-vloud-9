console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const axios = require("axios");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);

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

const AUTO_ROLE = "1448796463491584060";
const WELCOME_CHANNEL = "1487287724674384032";

// ================= SERVER =================
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

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Merge intro + main audio")
    .addAttachmentOption(o =>
      o.setName("intro").setDescription("Intro audio").setRequired(true))
    .addAttachmentOption(o =>
      o.setName("main").setDescription("Main audio").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create single choice role panel")
    .addStringOption(o =>
      o.setName("title").setDescription("Panel title").setRequired(true))

    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Label 1"))

    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Label 2"))

    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Label 3"))

    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addStringOption(o => o.setName("name4").setDescription("Label 4"))

    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
    .addStringOption(o => o.setName("name5").setDescription("Label 5"))

    .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
    .addStringOption(o => o.setName("name6").setDescription("Label 6"))

    .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
    .addStringOption(o => o.setName("name7").setDescription("Label 7"))

].map(c => c.toJSON());

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

// READY
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ================= TEXT NORMALIZER =================
// removes spaces, symbols, etc. to catch bypass attempts
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ================= MODERATION =================
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const raw = msg.content;
  const clean = normalize(raw);

  // 🚫 BLOCK DISCORD INVITES
  if (/discord\.gg|discord\.com\/invite/i.test(raw)) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`${msg.author}, links are not allowed.`);
  }

  // 🚫 BLOCK DOX / IP TERMS
  if (clean.includes("dox") || clean.includes("ipgrab") || clean.includes("iplogger")) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`${msg.author}, that content is not allowed.`);
  }

  // 🚫 PROFANITY / ABUSE (pattern based)
  const badPatterns = [
    "fuck","shit","bitch","cunt","asshole","slut","whore",
    "killyourself","kys","die","retard"
  ];

  if (badPatterns.some(w => clean.includes(w))) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`${msg.author}, your message was removed due to inappropriate language.`);
  }

});

// ================= ROLE + AUDIO (UNCHANGED CORE) =================
client.on(Events.InteractionCreate, async i => {

  if (i.isChatInputCommand() && i.commandName === "add") {
    await i.deferReply();

    const intro = i.options.getAttachment("intro");
    const main = i.options.getAttachment("main");

    const introPath = "intro.mp3";
    const mainPath = "main.mp3";
    const out = "out.mp3";

    const d1 = await axios({ url: intro.url, responseType: "stream" });
    const d2 = await axios({ url: main.url, responseType: "stream" });

    await new Promise(r => d1.data.pipe(fs.createWriteStream(introPath)).on("finish", r));
    await new Promise(r => d2.data.pipe(fs.createWriteStream(mainPath)).on("finish", r));

    ffmpeg()
      .input(introPath)
      .input(mainPath)
      .on("end", async () => {
        await i.editReply({ files: [out] });
        fs.unlinkSync(introPath);
        fs.unlinkSync(mainPath);
        fs.unlinkSync(out);
      })
      .mergeToFile(out);
  }

  if (i.isButton()) {
    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);
    const buttons = i.message.components.flatMap(r => r.components);

    for (const btn of buttons) {
      const id = btn.customId.replace("role_", "");
      if (member.roles.cache.has(id)) {
        await member.roles.remove(id).catch(()=>{});
      }
    }

    const roleId = i.customId.replace("role_", "");
    const role = await i.guild.roles.fetch(roleId).catch(()=>null);

    if (!role) return i.editReply("Role not found");

    await member.roles.add(roleId);
    i.editReply(`Role assigned: ${role}`);
  }

});

// ================= WELCOME =================
client.on("guildMemberAdd", async member => {
  await member.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome <@${member.id}>`);
});

// LOGIN
client.login(TOKEN);
