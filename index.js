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
    .addStringOption(o => o.setName("banner").setDescription("Banner URL"))

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

// ================= ROLE BUTTON =================
client.on(Events.InteractionCreate, async i => {

  if (i.isButton()) {

    const roleId = i.customId;
    const role = i.guild.roles.cache.get(roleId);

    if (!role) return i.reply({ content: "❌ Role not found", ephemeral: true });

    if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return i.reply({ content: "❌ Missing Manage Roles", ephemeral: true });
    }

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.reply({ content: `❌ Can't manage ${role}`, ephemeral: true });
    }

    try {
      if (i.member.roles.cache.has(roleId)) {
        await i.member.roles.remove(roleId);
        i.reply({ content: `➖ Removed ${role}`, ephemeral: true });
      } else {
        await i.member.roles.add(roleId);
        i.reply({ content: `✅ Added ${role}`, ephemeral: true });
      }
    } catch {
      i.reply({ content: "❌ Role error", ephemeral: true });
    }

    return;
  }

  if (!i.isChatInputCommand()) return;

  if (i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(i.options.getString("title"));

    const banner = i.options.getString("banner");
    if (banner) embed.setImage(banner);

    const rows = [];
    let row = new ActionRowBuilder();

    for (let x = 1; x <= 7; x++) {
      const role = i.options.getRole(`role${x}`);
      const name = i.options.getString(`name${x}`);
      const emoji = i.options.getString(`emoji${x}`);

      if (!role || !name) continue;

      const btn = new ButtonBuilder()
        .setCustomId(role.id)
        .setLabel(name)
        .setStyle(ButtonStyle.Secondary);

      if (emoji) btn.setEmoji(emoji);

      row.addComponents(btn);

      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
    }

    if (row.components.length > 0) rows.push(row);

    await i.channel.send({ embeds: [embed], components: rows });
    await i.reply({ content: "✅ Panel created", ephemeral: true });
  }

});

// ================= SAFE TRANSLATION =================
async function safeTranslate(text) {
  try {
    const res = await axios.get("https://api.mymemory.translated.net/get", {
      params: { q: text, langpair: "en|en" }
    });

    let detected = res.data.responseData.detectedSourceLanguage;

    // 🚫 FIX: block AUTO completely
    if (!detected || detected.toLowerCase() === "auto") return null;
    if (detected === "en") return null;

    const res2 = await axios.get("https://api.mymemory.translated.net/get", {
      params: { q: text, langpair: `${detected}|en` }
    });

    return res2.data.responseData.translatedText;

  } catch {
    return null;
  }
}

// ================= MESSAGE =================
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const text = msg.content;

  // translation
  if (!/^[\x00-\x7F]*$/.test(text) && text.length > 3) {
    const t = await safeTranslate(text);
    if (t && t.toLowerCase() !== text.toLowerCase()) {
      msg.reply(`🌍 ${t}`);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
