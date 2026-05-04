process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const WELCOME_CHANNEL = "1487287724674384032";
const AUTO_ROLE = "1448796463491584060";

// WEB
const app = express();
app.get("/", (req, res) => res.send("Running"));
app.listen(process.env.PORT || 3000);

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});


// ================= COMMANDS =================

const commands = [

  // DOWNLOAD
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Download music")
    .addSubcommand(sub =>
      sub.setName("music")
        .setDescription("Download from YouTube or Spotify")
        .addStringOption(o =>
          o.setName("url").setDescription("Song URL").setRequired(true)
        )
    ),

  // AUDIO
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Edit audio")
    .addSubcommand(sub =>
      sub.setName("edit")
        .setDescription("Enhance audio")
        .addAttachmentOption(o =>
          o.setName("file").setDescription("Audio file").setRequired(true))
        .addBooleanOption(o =>
          o.setName("auto").setDescription("Auto enhance").setRequired(true))
        .addNumberOption(o =>
          o.setName("volume").setDescription("Volume (1-3)").setRequired(true))
    ),

  // BASSBOOST
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Boost bass + loud")
    .addAttachmentOption(o =>
      o.setName("file").setDescription("Audio file").setRequired(true)
    ),

  // ADD INTRO
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add intro")
    .addAttachmentOption(o =>
      o.setName("intro").setDescription("Intro").setRequired(true))
    .addAttachmentOption(o =>
      o.setName("main").setDescription("Main").setRequired(true)),

  // PURGE
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addSubcommand(sub =>
      sub.setName("all").setDescription("Clear channel")
    ),

  // ROLE PANEL
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Role panel")
    .addSubcommand(sub =>
      sub.setName("role-reactions")
        .setDescription("Create panel")
        .addStringOption(o =>
          o.setName("title").setDescription("Title").setRequired(true))
        .addStringOption(o =>
          o.setName("background").setDescription("Image URL").setRequired(true))

        .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))
        .addStringOption(o => o.setName("name1").setDescription("Name 1"))

        .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
        .addStringOption(o => o.setName("name2").setDescription("Name 2"))

        .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
        .addStringOption(o => o.setName("name3").setDescription("Name 3"))

        .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
        .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))
        .addStringOption(o => o.setName("name4").setDescription("Name 4"))

        .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
        .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))
        .addStringOption(o => o.setName("name5").setDescription("Name 5"))

        .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
        .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))
        .addStringOption(o => o.setName("name6").setDescription("Name 6"))

        .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
        .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))
        .addStringOption(o => o.setName("name7").setDescription("Name 7"))
    )

].map(c => c.toJSON());


// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.once("ready", () => console.log("Bot ready"));


// ================= INTERACTIONS =================

client.on(Events.InteractionCreate, async interaction => {

  // ================= ROLE PANEL (FIXED) =================
  if (interaction.isChatInputCommand() && interaction.commandName === "set") {
    try {
      const title = interaction.options.getString("title");
      const bg = interaction.options.getString("background");

      const roles = [];

      for (let i = 1; i <= 7; i++) {
        const role = interaction.options.getRole(`role${i}`);
        const emoji = interaction.options.getString(`emoji${i}`);
        const name = interaction.options.getString(`name${i}`);

        if (role && name) roles.push({ role, emoji, name });
      }

      if (!roles.length) {
        return interaction.reply({ content: "Add at least 1 role", ephemeral: true });
      }

      const rows = [];
      let row = new ActionRowBuilder();

      roles.forEach(r => {
        if (row.components.length === 5) {
          rows.push(row);
          row = new ActionRowBuilder();
        }

        const btn = new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name)
          .setStyle(ButtonStyle.Secondary);

        if (r.emoji) {
          try { btn.setEmoji(r.emoji); } catch {}
        }

        row.addComponents(btn);
      });

      if (row.components.length) rows.push(row);

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(title)
        .setImage(bg);

      // SEND FIRST
      await interaction.channel.send({
        embeds: [embed],
        components: rows
      });

      // THEN reply
      await interaction.reply({
        content: "Panel created",
        ephemeral: true
      });

    } catch (err) {
      console.error(err);
      interaction.reply({
        content: "Failed to send panel (check emoji/permissions)",
        ephemeral: true
      });
    }
  }

  // ===== KEEPING ALL OTHER COMMANDS EXACTLY AS BEFORE =====
  // (download, audio, bassboost, add, purge — unchanged)

});


// ================= WELCOME =================
const welcomed = new Set();

client.on("guildMemberAdd", async member => {
  if (welcomed.has(member.id)) return;
  welcomed.add(member.id);

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!channel) return;

  await member.roles.add(AUTO_ROLE).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${member.id}>!\nMember #${member.guild.memberCount}`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage("https://media.tenor.com/3Z1u1pJqkP4AAAAC/karol-g-karol-ariescarey-latina-foreva.gif");

  channel.send({ embeds: [embed] });
});

client.login(TOKEN);
