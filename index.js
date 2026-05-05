console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const axios = require("axios");

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

// STAFF ROLE (CHANGE THIS)
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

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket system")
    .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Embed description").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Background image URL"))
    .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #111111)"))
    .addStringOption(o => o.setName("button").setDescription("Button name").setRequired(true))
    .addStringOption(o => o.setName("emoji").setDescription("Button emoji"))

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

// ===== WARNING =====
async function warn(channel, user, text) {
  const m = await channel.send(`${user}, ${text}`);
  setTimeout(() => m.delete().catch(()=>{}), 5000);
}

// ===== MODERATION =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  const text = msg.content.toLowerCase();

  if (/discord\.gg|discord\.com\/invite/.test(text)) {
    await msg.delete().catch(()=>{});
    return warn(msg.channel, msg.author, "links are not allowed.");
  }

  if (text.includes("dox") || text.includes("ip")) {
    await msg.delete().catch(()=>{});
    return warn(msg.channel, msg.author, "that content is not allowed.");
  }
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== CREATE PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setDescription(i.options.getString("description"))
      .setColor(i.options.getString("color") || "#111111");

    const img = i.options.getString("image");
    if (img) embed.setImage(img);

    const btn = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel(i.options.getString("button"))
      .setStyle(ButtonStyle.Primary);

    const emoji = i.options.getString("emoji");
    if (emoji) btn.setEmoji(emoji);

    const row = new ActionRowBuilder().addComponents(btn);

    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: "Panel created", ephemeral: true });
  }

  // ===== CREATE TICKET =====
  if (i.isButton() && i.customId === "create_ticket") {

    if (userTickets.has(i.user.id)) {
      return i.reply({ content: "You already have a ticket.", ephemeral: true });
    }

    ticketCount++;

    const channel = await i.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: i.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: i.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: STAFF_ROLE,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    userTickets.set(i.user.id, channel.id);

    const embed = new EmbedBuilder()
      .setTitle("Support Ticket")
      .setDescription(`User: <@${i.user.id}>`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: `<@${i.user.id}>`, embeds: [embed], components: [row] });

    i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (i.isButton() && i.customId === "claim") {

    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "Not allowed.", ephemeral: true });
    }

    i.reply({ content: `Claimed by ${i.user.tag}` });
  }

  // ===== CLOSE =====
  if (i.isButton() && i.customId === "close") {

    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "Not allowed.", ephemeral: true });
    }

    const userId = [...userTickets.entries()]
      .find(([_, ch]) => ch === i.channel.id)?.[0];

    if (userId) userTickets.delete(userId);

    await i.reply("Closing ticket...");
    setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
  }

});

// ===== WELCOME =====
client.on("guildMemberAdd", async m => {
  await m.roles.add(AUTO_ROLE).catch(()=>{});
  const ch = m.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome <@${m.id}>`);
});

// LOGIN
client.login(TOKEN);
