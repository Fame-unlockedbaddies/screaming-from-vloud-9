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

// ==================== LINK FILTER ====================

// Only TikTok links are strictly allowed (including short vm.tiktok.com links)
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// Dangerous patterns (still blocked)
const dangerousPatterns = [
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,           // Discord invites
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|trackip|myip\.is|ip-tracker|cliip\.net/i, // IP grabbers
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|free-robux|robux\.gift|getrobux/i, // Fake Roblox
  /cookie-logger|cookielogger|stealer|grabber|token-logger|beam\.link/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content;

  // Extract all URLs
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];

  let isBadLink = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // === ALLOW TIKTOK ===
    if (tiktokRegex.test(url)) {
      continue;
    }

    // === IGNORE ALL GIFS (do not block them) ===
    if (lowerUrl.endsWith('.gif') || 
        lowerUrl.includes('tenor.com') || 
        lowerUrl.includes('giphy.com') || 
        lowerUrl.includes('cdn.discordapp.com') || 
        lowerUrl.includes('media.discordapp.net')) {
      continue;   // Skip GIFs completely - do not treat as bad link
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

    // Block any other non-TikTok, non-GIF link
    if (lowerUrl.includes("http")) {
      isBadLink = true;
      reason = "Only TikTok links are allowed. GIFs are permitted but nothing else.";
      break;
    }
  }

  if (isBadLink) {
    try {
      // Delete the bad message instantly
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
          { name: "Allowed", value: "TikTok links and GIFs only", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });

      // Auto-delete the warning after 10 seconds
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} - ${reason}`);
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
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Bot - TikTok + GIFs Allowed` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot is online! Only TikTok links are blocked if malicious. All GIFs are now allowed.`);
