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
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  Events
} = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const AUTO_ROLE = "1448796463491584060";
const WELCOME_CHANNEL = "1487287724674384032";
const STAFF_ROLE = "1497843975615283350";

// ===== EXPRESS =====
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== MEMORY =====
const userTickets = new Map();
let ticketCount = 0;

// ===== IMAGE VALIDATION =====
function isValidImage(url) {
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i.test(url);
}

// ===== COMMANDS =====
const commands = [

  // ===== TICKET PANEL =====
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true))
    .addStringOption(o => o.setName("button").setDescription("Button text").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF URL"))
    .addStringOption(o => o.setName("color").setDescription("Hex color"))
    .addStringOption(o => o.setName("emoji").setDescription("Emoji")),

  // ===== ROLE PANEL =====
  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create role panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF URL"))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Name 1"))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Name 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Name 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addStringOption(o => o.setName("name4").setDescription("Name 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
    .addStringOption(o => o.setName("name5").setDescription("Name 5"))
    .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
    .addStringOption(o => o.setName("name6").setDescription("Name 6"))
    .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
    .addStringOption(o => o.setName("name7").setDescription("Name 7")),

  // ===== AUDIO =====
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Merge intro + main audio")
    .addAttachmentOption(o => o.setName("intro").setDescription("Intro").setRequired(true))
    .addAttachmentOption(o => o.setName("main").setDescription("Main").setRequired(true))

].map(c => c.toJSON());

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== WARN =====
async function warn(channel, user, text) {
  const m = await channel.send(`${user}, ${text}`);
  setTimeout(() => m.delete().catch(()=>{}), 5000);
}

// ===== MODERATION =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const t = msg.content.toLowerCase();

  if (/discord\.gg|discord\.com\/invite/.test(t)) {
    await msg.delete().catch(()=>{});
    return warn(msg.channel, msg.author, "links are not allowed.");
  }

  if (t.includes("dox") || t.includes("ip")) {
    await msg.delete().catch(()=>{});
    return warn(msg.channel, msg.author, "that content is not allowed.");
  }
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== ROLE PANEL =====
  if (i.isChatInputCommand() && i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setColor("#111111");

    const img = i.options.getString("image");
    if (img && isValidImage(img)) embed.setImage(img);

    const row = new ActionRowBuilder();

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
    }

    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: "Role panel created", ephemeral: true });
  }

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setDescription(i.options.getString("description"))
      .setColor(i.options.getString("color") || "#111111");

    const img = i.options.getString("image");
    if (img && isValidImage(img)) embed.setImage(img);

    const btn = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel(i.options.getString("button"))
      .setStyle(ButtonStyle.Primary);

    const emoji = i.options.getString("emoji");
    if (emoji) btn.setEmoji(emoji);

    const row = new ActionRowBuilder().addComponents(btn);

    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: "Ticket panel created", ephemeral: true });
  }

});

// ===== LOGIN =====
client.login(TOKEN);
