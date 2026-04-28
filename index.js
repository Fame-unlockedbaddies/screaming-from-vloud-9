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

// 🎭 roles they can choose from
const SELECTABLE_ROLES = {
  role1: "ROLE_ID_1",
  role2: "ROLE_ID_2",
  role3: "ROLE_ID_3"
};

// 🧠 store verified users
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("role1").setLabel("Role 1").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("role2").setLabel("Role 2").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("role3").setLabel("Role 3").setStyle(ButtonStyle.Secondary)
    );

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

    // BACKUP BUTTON
    if (interaction.customId === "backup_button") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Backup Verification");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter your access code")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    // ROLE BUTTONS
    if (SELECTABLE_ROLES[interaction.customId]) {

      if (!verifiedUsers.has(interaction.user.id)) {
        return interaction.reply({
          content: "❌ You are not verified.",
          ephemeral: true
        });
      }

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(SELECTABLE_ROLES[interaction.customId]);

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

      await member.roles.add(ROLE_ID);

      // ✅ mark as verified
      verifiedUsers.add(interaction.user.id);

      await interaction.reply({
        content: "👑 Verified! You can now use !selectrole",
        ephemeral: true
      });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "❌ Failed to verify.",
        ephemeral: true
      });
    }
  }
});

// 🚀 Start
client.login(TOKEN);
