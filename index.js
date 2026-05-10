console.log("BOOTING CLEAN BOT...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Events
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

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

  // OTHER WORDS YOU ADDED
  "dog",
  "jerk",
  "jerking off"
];

// ================= READY EVENT =================
client.once(Events.ClientReady, bot => {
  console.log(`Logged in as ${bot.user.tag}`);
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

      // DELETE MESSAGE FAST
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
