const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== COMMANDS =====
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.reply("Pong!");
  }

  if (command === "hello") {
    message.reply(`Hello ${message.author.username}`);
  }

  if (command === "help") {
    message.reply("Commands: !ping !hello !help");
  }
});

// ===== KEEP ALIVE WEB SERVER (IMPORTANT FOR RENDER) =====
require("http")
  .createServer((req, res) => {
    res.write("Bot is running");
    res.end();
  })
  .listen(process.env.PORT || 3000);

// ===== LOGIN =====
client.login(process.env.TOKEN);
