console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const axios = require("axios");
const fs = require("fs");

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

// ===== IMAGE FIX (WORKS WITH DISCORD CDN LINKS) =====
function fixImage(url) {
  if (!url) return null;

  // remove query junk so discord accepts it
  const clean = url.split("?")[0];

  if (clean.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return clean;

  return url; // fallback
}

// ===== COMMANDS =====
const commands = [

  // ===== TICKET PANEL =====
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true))
    .addStringOption(o => o.setName("button").setDescription("Button name").setRequired(true))
    .addStringOption(o => o.setName("category").setDescription("Category ID").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image or GIF"))
    .addStringOption(o => o.setName("color").setDescription("Hex color")),

  // ===== ROLE PANEL =====
  new SlashCommandBuilder()
    .setName("role-reaction-setup")
    .setDescription("Create role panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Banner"))
    .addRoleOption(o => o.setName("role1").setDescription("Role"))
    .addStringOption(o => o.setName("name1").setDescription("Name"))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addStringOption(o => o.setName("name2").setDescription("Name"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))
    .addStringOption(o => o.setName("name3").setDescription("Name"))
    .addRoleOption(o => o.setName("role4").setDescription("Role"))
    .addStringOption(o => o.setName("name4").setDescription("Name"))
    .addRoleOption(o => o.setName("role5").setDescription("Role"))
    .addStringOption(o => o.setName("name5").setDescription("Name"))
    .addRoleOption(o => o.setName("role6").setDescription("Role"))
    .addStringOption(o => o.setName("name6").setDescription("Name"))
    .addRoleOption(o => o.setName("role7").setDescription("Role"))
    .addStringOption(o => o.setName("name7").setDescription("Name"))

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

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== ROLE PANEL =====
  if (i.isChatInputCommand() && i.commandName === "role-reaction-setup") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setColor("#0f0f0f");

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

    await i.channel.send({ embeds: [embed], components: [row] });
    return i.reply({ content: "Panel created", ephemeral: true });
  }

  // ===== ROLE BUTTON =====
  if (i.isButton() && i.customId.startsWith("role_")) {

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);
    const buttons = i.message.components.flatMap(r => r.components);

    // remove ALL roles from this panel
    for (const btn of buttons) {
      const id = btn.customId.replace("role_", "");
      if (member.roles.cache.has(id)) {
        await member.roles.remove(id).catch(()=>{});
      }
    }

    const roleId = i.customId.replace("role_", "");
    const role = await i.guild.roles.fetch(roleId).catch(()=>null);

    if (!role) return i.editReply("Role not found");

    await member.roles.add(roleId);

    i.editReply(`Role set to ${role.name}`);
  }

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setDescription(i.options.getString("description"))
      .setColor(i.options.getString("color") || "#0f0f0f");

    const img = fixImage(i.options.getString("image"));
    if (img) embed.setImage(img);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`create_ticket_${i.options.getString("category")}`)
        .setLabel(i.options.getString("button"))
        .setStyle(ButtonStyle.Primary)
    );

    await i.channel.send({ embeds: [embed], components: [row] });
    return i.reply({ content: "Ticket panel created", ephemeral: true });
  }

  // ===== CREATE TICKET =====
  if (i.isButton() && i.customId.startsWith("create_ticket_")) {

    if (tickets.has(i.user.id)) {
      return i.reply({ content: "You already have a ticket.", ephemeral: true });
    }

    const category = i.customId.split("_")[2];

    ticketCount++;

    const ch = await i.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    tickets.set(i.user.id, ch.id);

    const embed = new EmbedBuilder()
      .setTitle("Support Ticket")
      .setDescription("A staff member will assist you shortly.")
      .setColor("#0f0f0f");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({ embeds: [embed], components: [row] });

    i.reply({ content: `Ticket created: ${ch}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (i.isButton() && i.customId === "claim") {
    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }

    await i.reply(`Claimed by ${i.user.tag}`);
  }

  // ===== CLOSE =====
  if (i.isButton() && i.customId === "close") {
    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }

    await i.reply("Closing ticket...");
    setTimeout(() => i.channel.delete().catch(()=>{}), 3000);
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
