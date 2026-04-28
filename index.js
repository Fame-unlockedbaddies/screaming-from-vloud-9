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

// 🌐 Web server (Render requirement)
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🔐 ENV
const TOKEN = process.env.TOKEN;

// 🔑 Config
const ACCESS_CODE = "charlie3026";
const ROLE_ID = "1497255894096941076";

// 🤖 Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 💬 Command → sends button
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Backup Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    message.reply({
      content: "Click the button below to enter your backup code:",
      components: [row]
    });
  }
});

// ⚡ Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {

  // 🔘 Button clicked → show modal
  if (interaction.isButton()) {
    if (interaction.customId === "backup_button") {

      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Backup Verification");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter your access code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  }

  // 🧾 Modal submitted
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "backup_modal") {

      const code = interaction.fields.getTextInputValue("code_input");

      if (code === ACCESS_CODE) {
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);

          await member.roles.add(ROLE_ID);

          await interaction.reply({
            content: "✅ You have accessed the highest role.\nThank you for using backup!\nMade by Fame",
            ephemeral: true
          });

        } catch (err) {
          console.error(err);
          await interaction.reply({
            content: "❌ Failed to assign role. Check permissions.",
            ephemeral: true
          });
        }
      } else {
        await interaction.reply({
          content: "❌ Incorrect code.",
          ephemeral: true
        });
      }
    }
  }
});

// 🚀 Login
client.login(TOKEN);
