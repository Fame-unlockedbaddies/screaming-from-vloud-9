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
  PermissionsBitField
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

  // 🎧 AUDIO MERGE
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Merge intro + main audio")
    .addAttachmentOption(o => o.setName("intro").setRequired(true).setDescription("Intro"))
    .addAttachmentOption(o => o.setName("main").setRequired(true).setDescription("Main")),

  // 🎭 ROLE PANEL
  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Single-choice role panel")
    .addStringOption(o => o.setName("title").setRequired(true).setDescription("Title"))

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

// ================= AUDIO COMMAND =================
client.on(Events.InteractionCreate, async i => {

  // ===== AUDIO =====
  if (i.isChatInputCommand() && i.commandName === "add") {

    await i.deferReply();

    const intro = i.options.getAttachment("intro");
    const main = i.options.getAttachment("main");

    try {
      const introPath = "intro.mp3";
      const mainPath = "main.mp3";
      const out = "out.mp3";

      const d1 = await axios({ url: intro.url, responseType: "stream" });
      const d2 = await axios({ url: main.url, responseType: "stream" });

      await new Promise(r => d1.data.pipe(fs.createWriteStream(introPath)).on("finish", r));
      await new Promise(r => d2.data.pipe(fs.createWriteStream(mainPath)).on("finish", r));

      exec(`ffmpeg -y -i ${introPath} -i ${mainPath} -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" ${out}`, async err => {
        if (err) return i.editReply("❌ ffmpeg error");

        await i.editReply({ files: [out] });

        fs.unlinkSync(introPath);
        fs.unlinkSync(mainPath);
        fs.unlinkSync(out);
      });

    } catch {
      i.editReply("❌ Failed");
    }
  }

  // ===== ROLE BUTTON =====
  if (i.isButton()) {

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);

    // get ALL buttons
    const allButtons = [];
    for (const row of i.message.components) {
      for (const btn of row.components) {
        allButtons.push(btn);
      }
    }

    // remove all roles
    for (const btn of allButtons) {
      const id = btn.customId.startsWith("role_")
        ? btn.customId.split("_")[1]
        : btn.customId;

      if (member.roles.cache.has(id)) {
        await member.roles.remove(id).catch(()=>{});
      }
    }

    const roleId = i.customId.startsWith("role_")
      ? i.customId.split("_")[1]
      : i.customId;

    const role = await i.guild.roles.fetch(roleId).catch(()=>null);

    if (!role) return i.editReply("❌ Role not found");

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.editReply("❌ Role too high");
    }

    await member.roles.add(roleId);

    i.editReply(`✅ You now have ${role}`);
  }

  // ===== ROLE PANEL =====
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

// ================= MODERATION =================
const badWords = ["dox","doxx","ho","fuck","shit","bitch"];
const blockedLinks = ["grabify","iplogger","discord.gg"];

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const txt = msg.content.toLowerCase();

  if (badWords.some(w => txt.includes(w))) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`⚠️ ${msg.author} not allowed`).then(m=>setTimeout(()=>m.delete(),4000));
  }

  if (blockedLinks.some(l => txt.includes(l))) {
    await msg.delete().catch(()=>{});
    return msg.channel.send(`🚫 ${msg.author} links blocked`).then(m=>setTimeout(()=>m.delete(),4000));
  }

  // ===== TRANSLATE =====
  if (txt.length > 3) {
    try {
      let t;

      // Libre
      try {
        const r = await axios.post("https://libretranslate.de/translate", {
          q: msg.content,
          source: "auto",
          target: "en"
        });
        t = r.data.translatedText;
      } catch {}

      // Google fallback
      if (!t || t.toLowerCase() === txt) {
        const g = await axios.get("https://translate.googleapis.com/translate_a/single", {
          params: { client:"gtx", sl:"auto", tl:"en", dt:"t", q:msg.content }
        });
        t = g.data[0].map(x=>x[0]).join("");
      }

      if (t && t.toLowerCase() !== txt) {
        msg.reply(`🌍 ${t}`);
      }

    } catch {}
  }

});

// ================= AUTO ROLE =================
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome <@${m.id}>`);
});

// ================= LOGIN =================
client.login(TOKEN);
