console.log("BOOTING CLEAN BOT...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// ================= KEEP ALIVE =================
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server online.");
});

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("sendmessage")
    .setDescription("Send a message through the bot")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("The message to send")
        .setRequired(true)
    )
].map(command => command.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Commands registered successfully.");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
})();

// ================= READY EVENT =================
client.once(Events.ClientReady, bot => {
  console.log(`Logged in as ${bot.user.tag}`);
});

// ================= COMMAND HANDLER =================
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // ONLY THE USER CAN SEE THIS WHILE BOT IS THINKING
    await interaction.deferReply({
      ephemeral: true
    });

    // ===== /sendmessage =====
    if (interaction.commandName === "sendmessage") {

      const message = interaction.options.getString("message");

      // SEND MESSAGE TO CHANNEL
      await interaction.channel.send({
        content: message
      });

      // HIDDEN CONFIRMATION
      await interaction.editReply({
        content: "Message sent."
      });
    }

  } catch (error) {

    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: "Something went wrong."
      });
    } else {
      await interaction.reply({
        content: "Something went wrong.",
        ephemeral: true
      });
    }
  }

});

// ================= LOGIN =================
client.login(TOKEN);
