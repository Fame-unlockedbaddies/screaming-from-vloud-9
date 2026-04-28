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

// 🔑 CONFIG
const ACCESS_CODE = "charlie3026";
const ROLE_ID = "1482560426972549232";
const CHANNEL_ID = "1448798824415101030";

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

// 💬 Command
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!backup") {

    // Restrict to channel
    if (message.channel.id !== CHANNEL_ID) {
      return message.reply("❌ Use this in the correct channel.");
    }

    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Backup Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await message.reply({
      content: "Click to enter your backup code:",
      components: [row]
    });
  }
});

// ⚡ Interactions
client.on(Events.InteractionCreate, async (interaction) => {

  // 🔘 Button
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

  // 🧾 Modal submit
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "backup_modal") {

      const code = interaction.fields.getTextInputValue("code_input");

      if (code !== ACCESS_CODE) {
        return interaction.reply({
          content: "❌ Incorrect code.",
          ephemeral: true
        });
      }

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        console.log(`Attempting to give role to ${interaction.user.tag}`);

        await member.roles.add(ROLE_ID);

        console.log("✅ ROLE GIVEN SUCCESSFULLY");

        await interaction.reply({
          content: "✅ You have been given the role.",
          ephemeral: true
        });

      } catch (err) {
        console.error("❌ ROLE ERROR:", err);

        await interaction.reply({
          content: "❌ Failed to assign role. Check bot permissions & role position.",
          ephemeral: true
        });
      }
    }
  }
});

// 🚀 Start bot
client.login(TOKEN);
