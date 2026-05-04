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

    ...[1,2,3,4,5,6,7].flatMap(n => [
      new SlashCommandBuilder().addRoleOption(o => o.setName(`role${n}`).setDescription(`Role ${n}`)),
      new SlashCommandBuilder().addStringOption(o => o.setName(`name${n}`).setDescription(`Label ${n}`)),
      new SlashCommandBuilder().addStringOption(o => o.setName(`emoji${n}`).setDescription(`Emoji ${n}`))
    ])
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands registered");
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= ROLE SYSTEM =================
client.on(Events.InteractionCreate, async i => {

  if (i.isButton()) {
    const role = i.guild.roles.cache.get(i.customId);

    if (!role) return i.reply({ content: "❌ Role not found", ephemeral: true });

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.reply({ content: `❌ Can't manage ${role}`, ephemeral: true });
    }

    if (i.member.roles.cache.has(role.id)) {
      await i.member.roles.remove(role.id);
      return i.reply({ content: `➖ Removed ${role}`, ephemeral: true });
    } else {
      await i.member.roles.add(role.id);
      return i.reply({ content: `✅ Added ${role}`, ephemeral: true });
    }
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

// ================= AUTO ROLE =================
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});

  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!ch) return;

  ch.send(`Welcome <@${m.id}>`);
});

// ================= MODERATION =================
function clean(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const badWords = ["fuck","shit","bitch","slut","whore","cunt","dick","pussy","asshole","dox","doxx"];
const wordFilters = [/\bdoxx?(ing|ed)?\b/i, /\bho(e|es)?\b/i];
const blockedLinks = ["grabify","iplogger","discord.gg","discord.com/invite"];

// ================= TRANSLATION SYSTEM =================

// 1️⃣ LibreTranslate
async function libre(text) {
  try {
    const res = await axios.post("https://libretranslate.de/translate", {
      q: text,
      source: "auto",
      target: "en",
      format: "text"
    });
    return res.data.translatedText;
  } catch { return null; }
}

// 2️⃣ Google fallback
async function google(text) {
  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: "auto",
          tl: "en",
          dt: "t",
          q: text
        }
      }
    );
    return res.data[0].map(x => x[0]).join("");
  } catch { return null; }
}

// ================= MESSAGE =================
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const raw = msg.content;
  const lowered = raw.toLowerCase();
  const cleaned = clean(raw);

  // filters
  if (wordFilters.some(r => r.test(raw)) || badWords.some(w => cleaned.includes(w))) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`⚠️ ${msg.author}, not allowed.`)
      .then(m => setTimeout(()=>m.delete(), 4000));
  }

  if (blockedLinks.some(l => lowered.includes(l))) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`🚫 ${msg.author}, links blocked.`)
      .then(m => setTimeout(()=>m.delete(), 4000));
  }

  // translation
  if (raw.length > 3) {
    let t = await libre(raw);
    if (!t || t.toLowerCase() === raw.toLowerCase()) {
      t = await google(raw);
    }

    if (t && t.toLowerCase() !== raw.toLowerCase()) {
      msg.reply(`🌍 ${t}`);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
