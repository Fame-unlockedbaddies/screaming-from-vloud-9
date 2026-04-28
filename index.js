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
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const SECRET_CODE = "1234"; // change this

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Step 1: User types !backup
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("open_backup_form")
      .setLabel("Enter Backup Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await message.reply({
      content: "Click the button to enter your backup code:",
      components: [row]
    });
  }
});

// Step 2: Handle button + modal
client.on(Events.InteractionCreate, async (interaction) => {
  // Button clicked → show modal
  if (interaction.isButton()) {
    if (interaction.customId === "open_backup_form") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Backup Verification");

      const codeInput = new TextInputBuilder()
        .setCustomId("backup_code")
        .setLabel("Enter your backup code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(codeInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  }

  // Step 3: Handle form submission
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "backup_modal") {
      const enteredCode = interaction.fields.getTextInputValue("backup_code");

      if (enteredCode === SECRET_CODE) {
        await interaction.reply({
          content: "✅ Code accepted. Backup started!",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: "❌ Invalid code.",
          ephemeral: true
        });
      }
    }
  }
});

client.login(process.env.TOKEN);
