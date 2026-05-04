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

  // AUDIO MERGE
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Merge intro + main audio")
    .addAttachmentOption(o => o.setName("intro").setRequired(true))
    .addAttachmentOption(o => o.setName("main").setRequired(true)),

  // ROLE PANEL
  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Single-choice roles")
    .addStringOption(o => o.setName("title").setRequired(true))

    .addRoleOption(o => o.setName("role1"))
    .addStringOption(o => o.setName("name1"))

    .addRoleOption(o => o.setName("role2"))
    .addStringOption(o => o.setName("name2"))

    .addRoleOption(o => o.setName("role3"))
    .addStringOption(o => o.setName("name3"))

    .addRoleOption(o => o.setName("role4"))
    .addStringOption(o => o.setName("name4"))

    .addRoleOption(o => o.setName("role5"))
    .addStringOption(o => o.setName("name5"))

    .addRoleOption(o => o.setName("role6"))
    .addStringOption(o => o.setName("name6"))

    .addRoleOption(o => o.setName("role7"))
    .addStringOption(o => o.setName("name7"))

].map(c => c.toJSON());

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

// READY
client.once("ready", () => {
  console.log(`✅ ${client.user.tag}`);
});

// ================= SIMPLE SPAM FILTER =================
function isSpam(text) {
  if (text.length < 3) return true;
  if (/^(.)\1{4,}$/i.test(text)) return true; // AAAAA
  return false;
}

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // AUDIO
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
      .on("error", () => i.editReply("❌ audio failed"))
      .mergeToFile(out);
  }

  // ROLE BUTTON (1 ROLE ONLY)
  if (i.isButton()) {

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);
    const buttons = i.message.components.flatMap(r => r.components);

    let removedRole = null;

    for (const btn of buttons) {
      const id = btn.customId.replace("role_", "");

      if (member.roles.cache.has(id)) {
        removedRole = `<@&${id}>`;
        await member.roles.remove(id).catch(()=>{});
      }
    }

    const roleId = i.customId.replace("role_", "");
    const role = await i.guild.roles.fetch(roleId).catch(()=>null);

    if (!role) return i.editReply("❌ Role not found");

    await member.roles.add(roleId);

    if (removedRole) {
      return i.editReply(
        `🔄 Removed ${removedRole}\n✅ You now have ${role}\n⚠️ Only ONE role allowed`
      );
    }

    i.editReply(`✅ You now have ${role}`);
  }

  // ROLE PANEL
  if (i.isChatInputCommand() && i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(i.options.getString("title"));

    const rows = [];
    let row = new ActionRowBuilder();

    for (let x = 1; x <= 7; x++) {
      const role = i.options.getRole(`role${x}`);
      const name = i.options.getString(`name${x}`);

      if (!role || !name) continue;

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${role.id}`)
          .setLabel(name)
          .setStyle(ButtonStyle.Secondary)
      );

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

// ================= MODERATION + TRANSLATION =================
const badWords = ["dox","doxx","doxxing","ho","fuck","shit","bitch"];
const badLinks = ["grabify","iplogger"];

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const txt = msg.content.toLowerCase();

  // BLOCK WORDS
  if (badWords.some(w => txt.includes(w))) {
    await msg.delete().catch(()=>{});
    return;
  }

  // BLOCK LINKS
  if (badLinks.some(l => txt.includes(l))) {
    await msg.delete().catch(()=>{});
    return;
  }

  // 🌍 TRANSLATE ANY LANGUAGE
  if (isSpam(msg.content)) return;

  try {
    const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
      params: {
        client: "gtx",
        sl: "auto",
        tl: "en",
        dt: "t",
        q: msg.content
      }
    });

    const translated = res.data[0].map(x => x[0]).join("");

    if (translated && translated.toLowerCase() !== txt) {
      msg.reply(`🌍 ${translated}`);
    }

  } catch {}
});

// ================= WELCOME =================
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome <@${m.id}>`);
});

// ================= LOGIN =================
client.login(TOKEN);
