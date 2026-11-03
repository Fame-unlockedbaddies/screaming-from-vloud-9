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

// Clean the token: remove whitespace/newlines, wrapping quotes and a "Bot " prefix
const token = (process.env.TOKEN || "")
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/^Bot\s+/i, "")
  .trim();

if (!token) {
  console.error("Missing TOKEN environment variable.");
  process.exit(1);
}

// Discord tokens only contain letters, numbers, dots, dashes and underscores
if (!/^[\w.-]+$/.test(token)) {
  console.error(
    "TOKEN contains invalid characters. Re-copy it from the Discord Developer Portal (Bot > Reset Token) and paste it into Render with no spaces, quotes or line breaks."
  );
  process.exit(1);
}

client.login(token).catch((err) => {
  console.error("Login failed:", err.message);
  process.exit(1);
});
