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
const ticketActivity = new Map();
let ticketCount = 0;

// ===== HELPERS =====
function fixImage(url) {
  if (!url) return null;
  return url.split("?")[0];
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true))
    .addStringOption(o => o.setName("button").setDescription("Button text").setRequired(true))
    .addStringOption(o => o.setName("category").setDescription("Category ID").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image URL"))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3")),

  new SlashCommandBuilder()
    .setName("role-reaction-setup")
    .setDescription("Create role panel")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Image URL"))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Name 1"))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Name 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Name 3")),

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

// ===== MESSAGE / MODERATION =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (ticketActivity.has(msg.channel.id)) {
    ticketActivity.set(msg.channel.id, Date.now());
  }

  const t = msg.content.toLowerCase();

  if (t.includes("dox") || t.includes("ip") || /discord\.gg|discord\.com\/invite/.test(t)) {
    await msg.delete().catch(()=>{});
    const warn = await msg.channel.send(`${msg.author}, that is not allowed.`);
    setTimeout(() => warn.delete().catch(()=>{}), 4000);
  }
});

// ===== AUTO CLOSE =====
setInterval(async () => {
  const now = Date.now();

  for (const [channelId, last] of ticketActivity.entries()) {
    if (now - last > 600000) {

      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      let ownerId = null;
      for (const [u, c] of tickets.entries()) {
        if (c === channelId) ownerId = u;
      }

      if (!ownerId) continue;

      await channel.send(`<@${ownerId}> Ticket inactive, closing in 10 seconds.`);

      setTimeout(async () => {
        tickets.delete(ownerId);
        ticketActivity.delete(channelId);
        await channel.delete().catch(()=>{});
      }, 10000);
    }
  }
}, 60000);

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async i => {

  // ===== ROLE PANEL CREATE =====
  if (i.isChatInputCommand() && i.commandName === "role-reaction-setup") {

    const embed = new EmbedBuilder()
      .setTitle(i.options.getString("title"))
      .setColor("#111111");

    const img = fixImage(i.options.getString("image"));
    if (img) embed.setImage(img);

    const row = new ActionRowBuilder();

    for (let x = 1; x <= 3; x++) {
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

    if (!row.components.length) {
      return i.reply({ content: "Add at least one role.", ephemeral: true });
    }

    await i.reply({ content: "Panel created", ephemeral: true });
    await i.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== 🔥 UNIVERSAL ROLE BUTTON FIX =====
  if (i.isButton() && i.customId.startsWith("role_")) {

    try {
      await i.deferReply({ ephemeral: true });

      const member = await i.guild.members.fetch(i.user.id);
      const roleId = i.customId.split("_")[1];
      const role = await i.guild.roles.fetch(roleId).catch(()=>null);

      if (!role) return i.editReply({ content: "Role not found." });

      if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return i.editReply({ content: "Bot missing Manage Roles permission." });
      }

      if (role.position >= i.guild.members.me.roles.highest.position) {
        return i.editReply({ content: "Role is higher than my role." });
      }

      // remove all roles from this panel
      for (const row of i.message.components) {
        for (const btn of row.components) {
          if (!btn.customId.startsWith("role_")) continue;

          const id = btn.customId.split("_")[1];
          if (member.roles.cache.has(id)) {
            await member.roles.remove(id).catch(()=>{});
          }
        }
      }

      await member.roles.add(roleId);

      return i.editReply({ content: `Role set to ${role.name}` });

    } catch (err) {
      console.error(err);
      if (!i.replied) {
        i.reply({ content: "Error assigning role.", ephemeral: true });
      }
    }
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

    const row = new ActionRowBuilder().addComponents(btn);

    await i.reply({ content: "Panel created", ephemeral: true });
    await i.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== CREATE TICKET =====
  if (i.isButton() && i.customId.startsWith("ticket_")) {

    const existing = tickets.get(i.user.id);
    if (existing && i.guild.channels.cache.get(existing)) {
      return i.reply({ content: "You already have a ticket.", ephemeral: true });
    }

    const parts = i.customId.split("_");
    const category = parts[1];
    const roleIds = parts[2] ? parts[2].split(",") : [];

    ticketCount++;

    const perms = [
      { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
    ];

    for (const r of roleIds) {
      perms.push({ id: r, allow: [PermissionsBitField.Flags.ViewChannel] });
    }

    const ch = await i.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: perms
    });

    tickets.set(i.user.id, ch.id);
    ticketActivity.set(ch.id, Date.now());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("Support Ticket")
      .setDescription("Support will be with you shortly.\n\nTo close this press the close button **Thankyou**")
      .addFields(
        { name: "Opened By", value: `<@${i.user.id}>`, inline: true },
        { name: "Ticket ID", value: `${ticketCount}`, inline: true },
        { name: "Created", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
      )
      .setColor("#111111");

    await ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: `Ticket created: ${ch}`, ephemeral: true });
  }

  // CLAIM
  if (i.isButton() && i.customId === "claim") {
    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }
    return i.reply({ content: "Ticket claimed", ephemeral: true });
  }

  // CLOSE
  if (i.isButton() && i.customId === "close") {

    if (!i.member.roles.cache.has(STAFF_ROLE)) {
      return i.reply({ content: "No permission", ephemeral: true });
    }

    let ownerId = null;
    for (const [u, c] of tickets.entries()) {
      if (c === i.channel.id) ownerId = u;
    }

    if (ownerId) {
      tickets.delete(ownerId);
      ticketActivity.delete(i.channel.id);
    }

    await i.reply({ content: "Closing...", ephemeral: true });

    setTimeout(() => {
      i.channel.delete().catch(()=>{});
    }, 2000);
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
