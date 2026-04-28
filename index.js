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

// 💬 Commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id !== CHANNEL_ID) return;

  // ➕ GIVE ROLE
  if (message.content === "!backup") {
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

  // ➖ REMOVE ROLE
  if (message.content === "!backupremove") {
    const button = new ButtonBuilder()
      .setCustomId("remove_button")
      .setLabel("Remove Backup Role")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(button);

    await message.reply({
      content: "Click to remove your role:",
      components: [row]
    });
  }
});

// ⚡ Interactions
client.on(Events.InteractionCreate, async (interaction) => {

  // 🔘 BUTTONS
  if (interaction.isButton()) {

    let modalId = "";

    if (interaction.customId === "backup_button") {
      modalId = "backup_modal";
    }

    if (interaction.customId === "remove_button") {
      modalId = "remove_modal";
    }

    if (!modalId) return;

    const modal = new ModalBuilder()
      .setCustomId(modalId)
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

      // ➕ GIVE ROLE
      if (interaction.customId === "backup_modal") {
        await member.roles.add(ROLE_ID);

        // 🗑️ delete button message
        try {
          await interaction.message.delete();
        } catch (e) {
          console.log("Could not delete message:", e.message);
        }

        await interaction.reply({
          content: "👑 Welcome back queen owner, we missed you — all has been restored.",
          ephemeral: true
        });
      }

      // ➖ REMOVE ROLE
      if (interaction.customId === "remove_modal") {
        await member.roles.remove(ROLE_ID);

        await interaction.reply({
          content: "✅ Role removed.",
          ephemeral: true
        });

        await interaction.channel.send(
          `⚠️ <@${interaction.user.id}> the role you used to have has now been taken due to using the action !backupremove`
        );
      }

    } catch (err) {
      console.error("❌ ROLE ERROR:", err);

      await interaction.reply({
        content: "❌ Failed to update role. Check permissions.",
        ephemeral: true
      });
    }
  }
});

// 🚀 Start
client.login(TOKEN);
