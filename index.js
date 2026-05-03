process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require("discord.js");

// ---------------- CONFIG ----------------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// ---------------- WEB ----------------
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// ---------------- BOT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ---------------- COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Setup systems")
    .addSubcommand(sub =>
      sub
        .setName("role-reactions")
        .setDescription("Create role panel")

        .addStringOption(o => o.setName("title").setDescription("Panel title").setRequired(true))
        .addStringOption(o => o.setName("background").setDescription("Image URL").setRequired(true))

        .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
        .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1").setRequired(true))
        .addStringOption(o => o.setName("name1").setDescription("Button name 1").setRequired(true))

        .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
        .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
        .addStringOption(o => o.setName("name2").setDescription("Button name 2"))

        .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
        .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
        .addStringOption(o => o.setName("name3").setDescription("Button name 3"))
    )
].map(c => c.toJSON());

// ---------------- REGISTER ----------------
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands loaded");
})();

client.once("ready", () => {
  console.log("Bot ready");
});

// ---------------- INTERACTIONS ----------------
client.on(Events.InteractionCreate, async interaction => {

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "set" &&
    interaction.options.getSubcommand() === "role-reactions"
  ) {

    // 🔥 hides "user used command"
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [
      {
        role: interaction.options.getRole("role1"),
        emoji: interaction.options.getString("emoji1"),
        name: interaction.options.getString("name1")
      },
      {
        role: interaction.options.getRole("role2"),
        emoji: interaction.options.getString("emoji2"),
        name: interaction.options.getString("name2")
      },
      {
        role: interaction.options.getRole("role3"),
        emoji: interaction.options.getString("emoji3"),
        name: interaction.options.getString("name3")
      }
    ].filter(r => r.role && r.emoji && r.name);

    const row = new ActionRowBuilder();

    roles.forEach(r => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name) // ✅ custom name
          .setEmoji(r.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    // 🔥 send panel publicly
    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    // 🔥 silent confirmation (only user sees)
    await interaction.editReply({ content: "Panel created.", ephemeral: true });
  }

  // BUTTON ROLE TOGGLE
  if (interaction.isButton() && interaction.customId.startsWith("role_")) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Role removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Role added", ephemeral: true });
    }
  }

});

// ---------------- START ----------------
client.login(TOKEN);
