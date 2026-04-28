const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require("discord.js");

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 Web server
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const ACCESS_CODE = process.env.ACCESS_CODE;

// 🔑 CONFIG
const ROLE_ID = "1482560426972549232";
const CHANNEL_ID = "1448798824415101030";

// 🧠 Verified users
const verifiedUsers = new Set();

// 🤖 Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// 💬 Commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  // 🔐 BACKUP
  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Backup Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return message.reply({
      content: "Click to enter your backup code:",
      components: [row]
    });
  }

  // 🎯 SELECT ROLE
  if (message.content === "!selectrole") {

    if (!verifiedUsers.has(message.author.id)) {
      return message.reply("❌ You must verify first using !backup.");
    }

    const roles = message.guild.roles.cache
      .filter(role =>
        role.editable &&
        !role.managed &&
        role.name !== "@everyone"
      )
      .first(5);

    if (!roles.length) {
      return message.reply("❌ No roles available.");
    }

    const buttons = roles.map(role =>
      new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(role.name)
        .setStyle(ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    return message.reply({
      content: "Choose your role:",
      components: [row]
    });
  }
});

// ⚡ Interactions
client.on(Events.InteractionCreate, async (interaction) => {

  // 🔘 BUTTONS
  if (interaction.isButton()) {

    // BACKUP BUTTON → open modal
    if (interaction.customId === "backup_button") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Backup Verification");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter your access code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    // ROLE BUTTONS
    if (interaction.customId.startsWith("role_")) {

      if (!verifiedUsers.has(interaction.user.id)) {
        return interaction.reply({
          content: "❌ You are not verified.",
          ephemeral: true
        });
      }

      const roleId = interaction.customId.split("_")[1];

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        await member.roles.add(roleId);

        return interaction.reply({
          content: "✅ Role given!",
          ephemeral: true
        });

      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "❌ Failed to give role.",
          ephemeral: true
        });
      }
    }
  }

  // 🧾 MODAL SUBMIT
  if (interaction.isModalSubmit()) {

    const code = interaction.fields.getTextInputValue("code_input");

    if (code !== ACCESS_CODE) {
      return interaction.reply({
        content: "❌ Incorrect code.",
        ephemeral: true
      });
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // give main role
      await member.roles.add(ROLE_ID);

      // mark verified
      verifiedUsers.add(interaction.user.id);

      await interaction.reply({
        content: "👑 Welcome back queen owner, we missed you — all has been restored.\nYou can now use !selectrole",
        ephemeral: true
      });

    } catch (err) {
      console.error("❌ ROLE ERROR:", err);

      await interaction.reply({
        content: "❌ Failed to assign role.",
        ephemeral: true
      });
    }
  }
});

// 🚀 Start
client.login(TOKEN);
