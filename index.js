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

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// ===== KEEP ALIVE (OPTIONAL) =====
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if bot is alive"),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message to send")
        .setRequired(true)
    )

].map(c => c.toJSON());

// ===== REGISTER COMMANDS =====
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Refreshing commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

// ===== READY =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong!");
  }

  // /say
  if (interaction.commandName === "say") {
    const msg = interaction.options.getString("message");
    return interaction.reply(msg);
  }

});

// ===== LOGIN =====
client.login(TOKEN);
