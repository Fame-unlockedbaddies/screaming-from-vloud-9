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

// ==================== ANTI-DOXXING FILTER ====================
// Allowed: TikTok + ALL GIFs (fixed)
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// Dangerous patterns
const dangerousPatterns = [
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|trackip|myip\.is|ip-tracker/i,
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|free-robux|robux\.gift|getrobux/i,
  /cookie-logger|cookielogger|stealer|grabber|token-logger|beam\.link|nitro\.gift|discord\.gift/i,
  /dox|doxx|ip logger|ip grabber/i,
];

// Personal info keywords
const personalInfoRegex = new RegExp(
  "school|highschool|university|college|address|street|home|phone|number|email|@gmail|@yahoo|location|city|town|zip code|postal|live in|born in|from |my school|my address|my phone|my email|my location",
  "i"
);

// IP addresses (full + partial like 67.838.828)
const ipRegex = /\b(?:\d{1,3}\.){1,3}\d{1,3}\b/g;

// Coordinates
const coordRegex = /\b\d{1,3}°\d{1,2}'\d{1,2}\.?\d*"?[NS]\s*\d{1,3}°\d{1,2}'\d{1,2}\.?\d*"?[EW]\b/gi;

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.content.match(urlRegex) || [];

  let shouldBlock = false;
  let reason = "";

  // Check URLs
  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // Allow TikTok
    if (tiktokRegex.test(url)) continue;

    // Allow ALL GIFs and Discord images
    if (
      lowerUrl.endsWith('.gif') ||
      lowerUrl.includes('tenor.com') ||
      lowerUrl.includes('giphy.com') ||
      lowerUrl.includes('cdn.discordapp.com') ||
      lowerUrl.includes('media.discordapp.net') ||
      lowerUrl.includes('imgur.com')
    ) {
      continue; // Do nothing - allow it
    }

    // Block any other link
    shouldBlock = true;
    reason = "Only TikTok links and GIFs are allowed.";
    break;
  }

  // Check dangerous patterns
  if (!shouldBlock) {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        shouldBlock = true;
        reason = "Potential doxxing / grabber detected";
        break;
      }
    }
  }

  // Check personal info
  if (!shouldBlock && personalInfoRegex.test(content)) {
    shouldBlock = true;
    reason = "Personal information / school / location sharing blocked";
  }

  // Check IPs
  if (!shouldBlock && ipRegex.test(message.content)) {
    shouldBlock = true;
    reason = "IP address sharing blocked";
  }

  // Check coordinates
  if (!shouldBlock && coordRegex.test(message.content)) {
    shouldBlock = true;
    reason = "Coordinates sharing blocked";
  }

  if (shouldBlock) {
    try {
      await message.delete().catch(() => {});

      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(15 * 60 * 1000, reason).catch(() => {});
      }

      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Safety Protection")
        .setDescription(`${message.author}, your message has been removed for your safety.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Allowed", value: "TikTok links and any GIFs only" }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => warningMsg.delete().catch(() => {}), 15000);

      console.log(`[ANTI-DOXX BLOCKED] ${message.author.tag} → ${reason}`);
    } catch (err) {
      console.error("[ANTI-DOXX ERROR]", err);
    }
  }
});

// ==================== UPTIME ====================
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Anti-Doxx Bot` }));
}).listen(PORT);

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

console.log(`${FAME_GAME_NAME} Anti-Doxx Bot is running!`);
console.log("→ GIFs are now fully allowed");
console.log("→ Blocks IPs, Coordinates, Personal Info, etc.");
