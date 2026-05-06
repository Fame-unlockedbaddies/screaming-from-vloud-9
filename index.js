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

// ===== IMAGE RESOLVER =====
async function resolveImage(url) {
  if (!url) return null;

  if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return url;

  try {
    if (url.includes("tenor.com")) {
      const html = await axios.get(url);
      const match = html.data.match(/https:\/\/media\.tenor\.com\/[^"]+\.gif/);
      if (match) return match[0];
    }

    if (url.includes("giphy.com")) {
      const id = url.split("-").pop();
      return `https://media.giphy.com/media/${id}/giphy.gif`;
    }
  } catch {}

  return null;
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true))
    .addStringOption(o => o.setName("button").setDescription("Button").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF link"))
    .addStringOption(o => o.setName("color").setDescription("Hex color"))
    .addStringOption(o => o.setName("emoji").setDescription("Emoji")),

  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create role panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF"))
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

// ===== MODERATION =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const t = msg.content.toLowerCase();

  if (/discord\.gg|discord\.com\/invite/.test(t) || t.includes("dox") || t.includes("ip")) {
    await msg.delete().catch(()=>{});
    const m = await msg.channel.send(`${msg.author}, that is not allowed.`);
    setTimeout(() => m.delete().catch(()=>{}), 5000);
  }
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== ROLE PANEL CREATE =====
  if (i.isChatInputCommand() && i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setColor("#111111");

    const img = await resolveImage(i.options.getString("image"));
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

    await i.channel.send({ embeds: [embed], components: [row] });
    return i.reply({ content: "Role panel created", ephemeral: true });
  }

  // ===== ROLE BUTTON =====
  if (i.isButton() && i.customId.startsWith("role_")) {

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);
    const buttons = i.message.components.flatMap(r => r.components);

    let removed = false;

    for (const btn of buttons) {
      const id = btn.customId.replace("role_", "");
      if (member.roles.cache.has(id)) {
        await member.roles.remove(id).catch(()=>{});
        removed = true;
      }
    }

    const roleId = i.customId.replace("role_", "");
    const role = await i.guild.roles.fetch(roleId).catch(()=>null);

    if (!role) return i.editReply("Role not found");

    await member.roles.add(roleId);

    i.editReply(
      removed
        ? `Previous role removed. New role: ${role}`
        : `Role assigned: ${role}`
    );
  }

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setDescription(i.options.getString("description"))
      .setColor(i.options.getString("color") || "#111111");

    const img = await resolveImage(i.options.getString("image"));
    if (img) embed.setImage(img);

    const btn = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel(i.options.getString("button"))
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    await i.channel.send({ embeds: [embed], components: [row] });
    return i.reply({ content: "Ticket panel created", ephemeral: true });
  }

  // ===== CREATE TICKET =====
  if (i.isButton() && i.customId === "create_ticket") {

    if (userTickets.has(i.user.id)) {
      return i.reply({ content: "You already have a ticket.", ephemeral: true });
    }

    ticketCount++;

    const ch = await i.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    userTickets.set(i.user.id, ch.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    ch.send({ content: `<@${i.user.id}>`, components: [row] });

    i.reply({ content: `Ticket created: ${ch}`, ephemeral: true });
  }

  // CLAIM / CLOSE same as before...
});

// ===== WELCOME =====
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome <@${m.id}>`);
});

// ===== LOGIN =====
client.login(TOKEN);
