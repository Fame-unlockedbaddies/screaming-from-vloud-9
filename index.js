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

// ==================== ANTI-DOXXING / LINK FILTER ====================
// Allowed: TikTok + ALL GIFs
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// Dangerous patterns (IP grabbers, token stealers, fake Roblox, Discord invites, etc.)
const dangerousPatterns = [
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,           // Discord invites
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|trackip|myip\.is|ip-tracker|ps3cfw/i,
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|free-robux|robux\.gift|getrobux|rb\.gy/i,
  /cookie-logger|cookielogger|stealer|grabber|token-logger|beam\.link|nitro\.gift|discord\.gift/i,
  /ip\.|logger|grab|track|spy|dox|doxx/i,                       // Extra broad protection
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.content.match(urlRegex) || [];

  let shouldBlock = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // 1. Allow TikTok
    if (tiktokRegex.test(url)) continue;

    // 2. Allow ALL GIFs / images
    if (
      lowerUrl.endsWith('.gif') ||
      lowerUrl.includes('tenor.com') ||
      lowerUrl.includes('giphy.com') ||
      lowerUrl.includes('cdn.discordapp.com') ||
      lowerUrl.includes('media.discordapp.net') ||
      lowerUrl.includes('imgur.com')
    ) {
      continue;
    }

    // 3. Check dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl) || pattern.test(content)) {
        shouldBlock = true;
        reason = "Potential doxxing / IP grabber / token stealer link";
        break;
      }
    }
    if (shouldBlock) break;

    // 4. Block any other external links
    if (lowerUrl.startsWith('http')) {
      shouldBlock = true;
      reason = "Only TikTok links and GIFs are allowed in this server.";
      break;
    }
  }

  if (shouldBlock) {
    try {
      await message.delete().catch(() => {});

      // Timeout the user
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Anti-Doxx: ${reason}`).catch(() => {});
      }

      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Doxxing Attempt Blocked")
        .setDescription(`${message.author}, your message has been removed for safety.`)
        .addFields(
          { name: "Reason", value: reason, inline: false },
          { name: "Allowed Content", value: "**TikTok links** and **any GIFs** only", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => warningMsg.delete().catch(() => {}), 15000);

      console.log(`[ANTI-DOXX] Blocked ${message.author.tag} → ${reason}`);
    } catch (err) {
      console.error("[ANTI-DOXX ERROR]", err);
    }
  }
});

// ==================== UPTIME SERVER ====================
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    status: "online", 
    message: `${FAME_GAME_NAME} Anti-Doxx Bot - TikTok + GIFs Allowed` 
  }));
}).listen(PORT);

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

console.log(`${FAME_GAME_NAME} Anti-Doxx Bot started!`);
console.log("→ Protects users from IP grabbers, token stealers & doxxing links");
console.log("→ TikTok & all GIFs allowed");
