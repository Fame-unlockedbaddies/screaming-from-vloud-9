console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const axios = require("axios");

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
  PermissionsBitField
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const AUTO_ROLE = "1448796463491584060";
const WELCOME_CHANNEL = "1487287724674384032";

// ================= KEEP ALIVE =================
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

// ================= COMMAND =================
const commands = [
  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create a role panel")
    .addStringOption(o => o.setName("title").setRequired(true).setDescription("Title"))
    .addStringOption(o => o.setName("banner").setDescription("Image URL"))

    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Label 1"))
    .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))

    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Label 2"))
    .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))

    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Label 3"))
    .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))

    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addStringOption(o => o.setName("name4").setDescription("Label 4"))
    .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))

    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
    .addStringOption(o => o.setName("name5").setDescription("Label 5"))
    .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))

    .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
    .addStringOption(o => o.setName("name6").setDescription("Label 6"))
    .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))

    .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
    .addStringOption(o => o.setName("name7").setDescription("Label 7"))
    .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands
  });
  console.log("Commands registered");
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= STRONG FILTER =================

// normalize text (removes spaces, symbols)
function clean(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove symbols
}

const badWords = [
  "fuck","shit","bitch","slut","whore","cunt","dick","pussy","asshole",
  "nigga","nigger","retard","faggot","hoe","bastard","twat"
];

const blockedLinks = [
  "grabify","iplogger","2no.co","discord.gg","discord.com/invite"
];

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const raw = msg.content.toLowerCase();
  const cleaned = clean(msg.content);

  // ===== SWEAR FILTER =====
  if (badWords.some(w => cleaned.includes(w))) {
    await msg.delete().catch(() => {});
    const warn = await msg.channel.send(`⚠️ ${msg.author}, watch your language.`);
    setTimeout(() => warn.delete().catch(() => {}), 4000);
    return;
  }

  // ===== LINK BLOCK =====
  if (blockedLinks.some(l => raw.includes(l))) {
    await msg.delete().catch(() => {});
    const warn = await msg.channel.send(`🚫 ${msg.author}, links not allowed.`);
    setTimeout(() => warn.delete().catch(() => {}), 4000);
    return;
  }

  // ===== TRANSLATION =====
  if (!/^[\x00-\x7F]*$/.test(msg.content) && msg.content.length > 3) {
    try {
      const res = await axios.get("https://api.mymemory.translated.net/get", {
        params: { q: msg.content, langpair: "auto|en" }
      });

      const t = res.data.responseData.translatedText;

      if (t && t.toLowerCase() !== msg.content.toLowerCase()) {
        msg.reply(`🌍 ${t}`);
      }

    } catch {}
  }
});

// ================= LOGIN =================
client.login(TOKEN);
