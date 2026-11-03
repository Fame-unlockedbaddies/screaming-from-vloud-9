const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");

// --- Keep-alive web server (Render needs an open port) ---
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is online!");
  })
  .listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// --- Discord bot ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    message.reply("Pong!");
  }
});

if (!process.env.TOKEN) {
  console.error("Missing TOKEN environment variable.");
  process.exit(1);
}

client.login(process.env.TOKEN);
