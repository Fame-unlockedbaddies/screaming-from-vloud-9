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

// Web server (Render requirement)
app.get("/", (req, res) => {
  res.send("Bot is running.");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ENV
const TOKEN = process.env.TOKEN;
const ACCESS_CODE = process.env.ACCESS_CODE;

// CONFIG
const ROLE_ID = "1482560426972549232";
const CHANNEL_ID = "1448798824415101030";

// Store verified users (temporary)
const verifiedUsers = new Set();

// Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  // BACKUP COMMAND
  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Verification Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return message.reply({
      content: "To restore your access, select the option below and enter your verification code.",
      components: [row]
    });
  }

  // SELECT ROLE COMMAND
  if (message.content === "!selectrole") {

    if (!verifiedUsers.has(message.author.id)) {
      return message.reply("Access denied. You must complete verification using !backup before selecting a role.");
    }

    const roles = message.guild.roles.cache
      .filter(role =>
        role.editable &&
        !role.managed &&
        role.name !== "@everyone"
      )
      .first(5);

    if (!roles.length) {
      return message.reply("No assignable roles are currently available.");
    }

    const buttons = roles.map(role =>
      new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(role.name)
        .setStyle(ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    return message.reply({
      content: "Please choose one of the available roles below.",
      components: [row]
    });
  }
});

// Interactions
client.on(Events.InteractionCreate, async (interaction) => {

  // BUTTON HANDLER
  if (interaction.isButton()) {

    // Backup button
    if (interaction.customId === "backup_button") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Verification Required");

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

    // Role selection buttons
    if (interaction.customId.startsWith("role_")) {

      if (!verifiedUsers.has(interaction.user.id)) {
        return interaction.reply({
          content: "Access denied. You are not verified.",
          ephemeral: true
        });
      }

      const roleId = interaction.customId.split("_")[1];

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        await member.roles.add(roleId);

        return interaction.reply({
          content: "Your selected role has been successfully assigned.",
          ephemeral: true
        });

      } catch (err) {
        console.error(err);

        return interaction.reply({
          content: "The role could not be assigned. Please contact an administrator if the issue persists.",
          ephemeral: true
        });
      }
    }
  }

  // MODAL SUBMIT
  if (interaction.isModalSubmit()) {

    const code = interaction.fields.getTextInputValue("code_input");

    if (code !== ACCESS_CODE) {
      return interaction.reply({
        content: "The access code you entered is invalid. Please try again.",
        ephemeral: true
      });
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      await member.roles.add(ROLE_ID);

      // mark verified
      verifiedUsers.add(interaction.user.id);

      await interaction.reply({
        content: "Welcome back. Your access has been successfully restored. You may now proceed to select your role using the command !selectrole.",
        ephemeral: true
      });

    } catch (err) {
      console.error("ROLE ERROR:", err);

      return interaction.reply({
        content: "Access restoration failed due to a permissions issue. Please contact an administrator.",
        ephemeral: true
      });
    }
  }
});

// Start bot
client.login(TOKEN);
