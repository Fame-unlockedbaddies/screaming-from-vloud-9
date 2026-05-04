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
    .setDescription("Create a role panel with banner")

    .addStringOption(o =>
      o.setName("title").setDescription("Panel title").setRequired(true))

    .addStringOption(o =>
      o.setName("banner").setDescription("Banner image URL"))

    // 7 roles
    ...Array.from({ length: 7 }, (_, i) => (i + 1)).flatMap(n => ([
      new SlashCommandBuilder().addRoleOption(o =>
        o.setName(`role${n}`).setDescription(`Role ${n}`)),
      new SlashCommandBuilder().addStringOption(o =>
        o.setName(`name${n}`).setDescription(`Label ${n}`)),
      new SlashCommandBuilder().addStringOption(o =>
        o.setName(`emoji${n}`).setDescription(`Emoji ${n}`))
    ]))

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

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // ===== BUTTON =====
  if (i.isButton()) {
    let roleId = i.customId.startsWith("role_")
      ? i.customId.split("_")[1]
      : i.customId;

    const role = i.guild.roles.cache.get(roleId);

    if (!role) {
      return i.reply({ content: "❌ Role not found", ephemeral: true });
    }

    if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return i.reply({ content: "❌ Missing Manage Roles", ephemeral: true });
    }

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.reply({ content: `❌ Can't manage ${role}`, ephemeral: true });
    }

    try {
      if (i.member.roles.cache.has(roleId)) {
        await i.member.roles.remove(roleId);
        await i.reply({ content: `➖ Removed ${role} (${role.name})`, ephemeral: true });
      } else {
        await i.member.roles.add(roleId);
        await i.reply({ content: `✅ Added ${role} (${role.name})`, ephemeral: true });
      }
    } catch (err) {
      console.error(err);
      i.reply({ content: "❌ Error assigning role", ephemeral: true });
    }

    return;
  }

  if (!i.isChatInputCommand()) return;

  // ===== ROLE PANEL =====
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

// ================= AUTO ROLE + WELCOME =================
client.on("guildMemberAdd", async member => {
  await member.roles.add(AUTO_ROLE).catch(() => {});

  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${member.id}>`)
    .setThumbnail(member.user.displayAvatarURL());

  ch.send({ embeds: [embed] });
});

// ================= MODERATION + TRANSLATION =================

const badWords = [
  "fuck","shit","bitch","slut","whore","cunt","dick","pussy","asshole"
];

const blockedLinks = [
  "grabify","iplogger","2no.co","discord.gg/","discord.com/invite"
];

function isEnglish(text) {
  return /^[\x00-\x7F]*$/.test(text);
}

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const content = msg.content.toLowerCase();

  // bad words
  if (badWords.some(w => content.includes(w))) {
    await msg.delete().catch(() => {});
    const warn = await msg.channel.send(`⚠️ ${msg.author}, watch your language.`);
    setTimeout(() => warn.delete().catch(() => {}), 4000);
    return;
  }

  // blocked links
  if (blockedLinks.some(l => content.includes(l))) {
    await msg.delete().catch(() => {});
    const warn = await msg.channel.send(`🚫 ${msg.author}, that link is not allowed.`);
    setTimeout(() => warn.delete().catch(() => {}), 4000);
    return;
  }

  // translation
  if (!isEnglish(msg.content) && msg.content.length > 3) {
    try {
      const res = await axios.get("https://api.mymemory.translated.net/get", {
        params: { q: msg.content, langpair: "auto|en" }
      });

      const t = res.data.responseData.translatedText;

      if (t && t.toLowerCase() !== msg.content.toLowerCase()) {
        msg.reply(`🌍 ${t}`);
      }

    } catch (e) {
      console.error("Translate error:", e.message);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
