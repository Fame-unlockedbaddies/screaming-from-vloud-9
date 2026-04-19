const http = require("http");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
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

// ==================== ALLOWED LINKS ====================

// TikTok (including short vm.tiktok.com links)
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// GIF links (Tenor, Giphy, direct .gif, Imgur)
const gifRegex = /https?:\/\/(?:www\.)?(?:tenor\.com|c\.tenor\.com|giphy\.com|imgur\.com).*?(?:\.gif|gif\/)/i;

// Dangerous / blocked patterns (cookie stealers, fake Roblox, IP grabbers, Discord invites, etc.)
const dangerousPatterns = [
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|ps3cfw\.com|trackip|myip\.is|ip-tracker|cliip\.net|linklog|redir\.me/i,
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|robloxapp|free-robux|robux\.gift|getrobux/i,
  /cookie-logger|cookielogger|beamer|beam\.link|stealer|grabber|token-logger/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content;

  // Find all URLs
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];

  let isBadLink = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // Allow TikTok links
    if (tiktokRegex.test(url)) {
      continue;
    }

    // Allow GIF links
    if (gifRegex.test(url) || lowerUrl.endsWith('.gif')) {
      continue;
    }

    // Check dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        isBadLink = true;
        reason = "Malicious link detected (Cookie Stealer, IP Grabber, or Fake Roblox)";
        break;
      }
    }

    if (isBadLink) break;

    // Block any other link
    if (lowerUrl.includes("http")) {
      isBadLink = true;
      reason = "Only TikTok and GIF links (Tenor, Giphy, .gif) are allowed in this server.";
      break;
    }
  }

  if (isBadLink) {
    try {
      await message.delete().catch(() => {});

      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Posted unsafe link: ${reason}`).catch(() => {});
      }

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

      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} - ${reason} | Link: ${urls[0]}`);
    } catch (err) {
      console.error("[LINK BLOCKER ERROR]", err);
    }
  }
});

// ==================== ROLEALL COMMAND ====================
// Paste your full roleall code here (it remains unchanged)

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roleall") {
    // Your existing roleall logic goes here...
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
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Bot - TikTok + GIF Only` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot online! Allowed: TikTok links + GIFs (Tenor, Giphy, .gif, Imgur). Malicious links still blocked.`);
