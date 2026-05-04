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

  // ROLE PANEL (FAST FIX)
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

  // ROLE PANEL (FAST FIX)
  if (interaction.commandName === "set") {

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    for (let i = 1; i <= 7; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const emoji = interaction.options.getString(`emoji${i}`);
      const name = interaction.options.getString(`name${i}`);

      if (role && emoji && name) roles.push({ role, emoji, name });
    }

    if (!roles.length) {
      return interaction.reply({ content: "Add roles", ephemeral: true });
    }

    const rows = [];
    let row = new ActionRowBuilder();

    roles.forEach(r => {
      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name)
          .setEmoji(r.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    if (row.components.length > 0) rows.push(row);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.reply({
      content: "Done",
      ephemeral: true
    });

    await interaction.channel.send({
      embeds: [embed],
      components: rows
    });
  }

  // KEEP OTHER COMMANDS SAME (they already defer correctly)

});

client.login(TOKEN);
