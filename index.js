const http = require("http");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  WebhookClient,
} = require("discord.js");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
const FAME_GAME_NAME = process.env.FAME_GAME_NAME || "Fame";
const FOUNDER_ROLE_ID = "1482560426972549232";

if (!TOKEN) {
  console.error("Missing TOKEN environment variable");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel],
});

// ==================== IMPROVED TIKTOK DETECTION ====================

// Allowed TikTok patterns (including vm.tiktok.com short links like ZNRq2quMg)
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// Dangerous / blocked patterns
const dangerousPatterns = [
  // Discord invites
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,

  // IP Grabbers & Loggers
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|ps3cfw\.com|trackip|myip\.is|ip-tracker|cliip\.net|linklog|redir\.me/i,

  // Fake Roblox / Cookie Stealer domains
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|robloxapp|free-robux|robux\.gift|getrobux/i,

  // Other stealers / phishing
  /cookie-logger|cookielogger|beamer|beam\.link|stealer|grabber|token-logger/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content;

  // Find all URLs in the message
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];

  let isBadLink = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // Check if it's a valid TikTok link (including vm.tiktok.com short format)
    if (tiktokRegex.test(url)) {
      continue; // TikTok is allowed → skip
    }

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        isBadLink = true;
        reason = "Malicious link detected (Cookie Stealer, IP Grabber, or Fake Roblox)";
        break;
      }
    }

    if (isBadLink) break;

    // If it's any other link that's not TikTok → block it
    if (lowerUrl.includes("http")) {
      isBadLink = true;
      reason = "Only TikTok links are allowed in this server.";
      break;
    }
  }

  if (isBadLink) {
    try {
      // Delete the message instantly
      await message.delete().catch(() => {});

      // Timeout the user for 10 minutes
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Posted unsafe link: ${reason}`).catch(() => {});
      }

      // Warning message
      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Unsafe Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason, inline: false },
          { name: "Action", value: "Message deleted + 10-minute timeout", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });

      // Auto-delete warning after 10 seconds
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} - ${reason} | Link: ${urls[0]}`);
    } catch (err) {
      console.error("[LINK BLOCKER ERROR]", err);
    }
  }
});

// ==================== ROLEALL COMMAND ====================
// (Paste your full roleall code here - it was unchanged)

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roleall") {
    // Your existing roleall code goes here...
    // (I kept it out for brevity - copy from previous version)
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

// HTTP Server
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Bot - TikTok Only Mode` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot is online! Only TikTok links (including vm.tiktok.com short links) are allowed.`);
