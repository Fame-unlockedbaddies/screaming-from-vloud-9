console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const axios = require("axios");
const fs = require("fs");

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

const STAFF_ROLE = "1497843975615283350";
const AUTO_ROLE = "1448796463491584060";
const WELCOME_CHANNEL = "1487287724674384032";

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
const tickets = new Map();
let ticketCount = 0;

// ===== HELPERS =====
function fixImage(url) {
  if (!url) return null;
  return url.split("?")[0];
}

function parseEmoji(input) {
  if (!input) return null;
  const match = input.match(/<a?:\w+:(\d+)>/);
  if (match) return { id: match[1] };
  return input;
}

// ===== COMMANDS =====
const commands = [

  // ===== TICKET PANEL =====
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create a ticket panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true))
    .addStringOption(o => o.setName("button").setDescription("Button text").setRequired(true))
    .addStringOption(o => o.setName("category").setDescription("Category ID").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF URL"))
    .addStringOption(o => o.setName("emoji").setDescription("Button emoji"))
    .addRoleOption(o => o.setName("role1").setDescription("Access Role 1"))
    .addRoleOption(o => o.setName("role2").setDescription("Access Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Access Role 3")),

  // ===== ROLE PANEL =====
  new SlashCommandBuilder()
    .setName("role-reaction-setup")
    .setDescription("Create role selection panel")
    .addStringOption(o => o.setName("title").setDescription("Panel title").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Banner URL"))
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
    .addStringOption(o => o.setName("name7").setDescription("Label 7")),

  // ===== AUDIO MERGE =====
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Merge intro + main audio")
    .addAttachmentOption(o => o.setName("intro").setDescription("Intro audio").setRequired(true))
    .addAttachmentOption(o => o.setName("main").setDescription("Main audio").setRequired(true))

].map(c => c.toJSON());

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== MODERATION =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const t = msg.content.toLowerCase();

  if (t.includes("dox") || t.includes("ip") || /discord\.gg|discord\.com\/invite/.test(t)) {
    await msg.delete().catch(()=>{});
    const warn = await msg.channel.send(`${msg.author}, that is not allowed.`);
    setTimeout(() => warn.delete().catch(()=>{}), 4000);
  }
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== ROLE PANEL =====
  if (i.isChatInputCommand() && i.commandName === "role-reaction-setup") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setColor("#111111");

    const img = fixImage(i.options.getString("image"));
    if (img) embed.setImage(img);

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

    await i.reply({ content: "Panel created", ephemeral: true });
    await i.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== ROLE BUTTON =====
  if (i.isButton() && i.customId.startsWith("role_")) {

    const member = await i.guild.members.fetch(i.user.id);

    for (const row of i.message.components) {
      for (const btn of row.components) {
        const id = btn.customId.split("_")[1];
        if (member.roles.cache.has(id)) {
          await member.roles.remove(id).catch(()=>{});
        }
      }
    }

    const roleId = i.customId.split("_")[1];
    await member.roles.add(roleId);

    const role = await i.guild.roles.fetch(roleId);

    return i.reply({ content: `Role set to ${role.name}`, ephemeral: true });
  }

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setDescription(i.options.getString("description"))
      .setColor("#111111");

    const img = fixImage(i.options.getString("image"));
    if (img) embed.setImage(img);

    const roles = [
      i.options.getRole("role1")?.id,
      i.options.getRole("role2")?.id,
      i.options.getRole("role3")?.id
    ].filter(Boolean);

    const btn = new ButtonBuilder()
      .setCustomId(`ticket_${i.options.getString("category")}_${roles.join(",")}`)
      .setLabel(i.options.getString("button"))
      .setStyle(ButtonStyle.Primary);

    const emoji = parseEmoji(i.options.getString("emoji"));
    if (emoji) btn.setEmoji(emoji);

    const row = new ActionRowBuilder().addComponents(btn);

    await i.reply({ content: "Panel created", ephemeral: true });
    await i.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== CREATE TICKET =====
  if (i.isButton() && i.customId.startsWith("ticket_")) {

    if (tickets.has(i.user.id)) {
      return i.reply({ content: "You already have a ticket.", ephemeral: true });
    }

    const parts = i.customId.split("_");
    const category = parts[1];
    const roleIds = parts[2] ? parts[2].split(",") : [];

    ticketCount++;

    const permissions = [
      { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
    ];

    for (const r of roleIds) {
      permissions.push({
        id: r,
        allow: [PermissionsBitField.Flags.ViewChannel]
      });
    }

    const ch = await i.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: permissions
    });

    tickets.set(i.user.id, ch.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({ content: "Support will assist you shortly.", components: [row] });

    return i.reply({ content: `Ticket created: ${ch}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (i.isButton() && i.customId === "claim") {
    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }

    return i.reply({ content: "Ticket claimed", ephemeral: true });
  }

  // ===== CLOSE =====
  if (i.isButton() && i.customId === "close") {
    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }

    await i.reply({ content: "Closing...", ephemeral: true });
    setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
  }

});

// ===== WELCOME =====
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome ${m.user.tag}`);
});

// ===== LOGIN =====
client.login(TOKEN);
