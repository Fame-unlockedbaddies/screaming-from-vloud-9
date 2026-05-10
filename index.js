console.log("BOOTING CLEAN BOT...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ================= BLACKLIST =================
const blacklist = [
  // RACIAL SLURS
  "nigger",
  "chink",
  "coon",
  "spic",
  "wetback",
  "kike",
  "gook",
  "paki",
  "raghead",
  "beaner",
  "redskin",
  "camel jockey",
  "zipperhead",
  "porch monkey",
  "towelhead",
  "gypsy",

  // LGBT / TRANS SLURS
  "faggot",
  "fag",
  "fggt",
  "tranny",
  "troon",
  "shemale",
  "dyke",
  "dike",
  "twink",
  "twinkie",
  "ponk",
  "he she",
  "it pretending to be a woman",
  "it pretending to be a man",

  // SELF HARM
  "kys",
  "kms",
  "khs",
  "kill yourself",
  "killing myself",
  "suicide",
  "self harm",

  // OTHER WORDS
  "dog",
  "jerk",
  "jerking off"
];

// ================= WORDS SHOWN IN EMBED =================
const embedWords = blacklist.filter(
  word =>
    word !== "dog" &&
    word !== "jerk" &&
    word !== "jerking off"
);

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("whatperioddoes")
    .setDescription("Shows all blacklisted words")
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

    console.log("Commands registered.");

  } catch (error) {
    console.error(error);
  }
})();

// ================= READY EVENT =================
client.once(Events.ClientReady, bot => {
  console.log(`Logged in as ${bot.user.tag}`);
});

// ================= SLASH COMMANDS =================
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    if (interaction.commandName === "whatperioddoes") {

      const embed = new EmbedBuilder()
        .setTitle("Blacklisted Words")
        .setDescription(embedWords.join("\n"))
        .setColor("Red");

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);
  }
});

// ================= MESSAGE FILTER =================
client.on(Events.MessageCreate, async message => {

  // IGNORE BOTS
  if (message.author.bot) return;

  // IGNORE EMPTY MESSAGES
  if (!message.content) return;

  const content = message.content.toLowerCase();

  // CHECK FOR BLACKLISTED WORDS
  const foundWord = blacklist.find(word =>
    content.includes(word.toLowerCase())
  );

  if (foundWord) {

    try {

      // DELETE MESSAGE
      await message.delete();

      // DM USER
      await message.author.send(
        `You used this word which is against our TOS: "${foundWord}"`
      );

      console.log(
        `Deleted message from ${message.author.tag} for using: ${foundWord}`
      );

    } catch (error) {
      console.error("Failed to moderate message:", error);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
