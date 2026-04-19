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

// Allowed: TikTok links (including short vm.tiktok.com links)
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

// Dangerous / blocked patterns
const dangerousPatterns = [
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,                    // Discord invites
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|trackip|myip\.is|ip-tracker/i,
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|free-robux|robux\.gift|getrobux/i,         // Fake Roblox
  /cookie-logger|cookielogger|stealer|grabber|token-logger|beam\.link/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  // Find all URLs
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.content.match(urlRegex) || [];

  let shouldBlock = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // 1. Allow TikTok links
    if (tiktokRegex.test(url)) {
      continue;
    }

    // 2. COMPLETELY IGNORE ALL GIF LINKS - DO NOT BLOCK THEM
    if (lowerUrl.endsWith('.gif') ||
        lowerUrl.includes('tenor.com') ||
        lowerUrl.includes('giphy.com') ||
        lowerUrl.includes('cdn.discordapp.com') ||
        lowerUrl.includes('media.discordapp.net') ||
        lowerUrl.includes('imgur.com')) {
      continue;                    // Skip - do nothing, allow the GIF
    }

    // 3. Check for malicious patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        shouldBlock = true;
        reason = "Malicious link (Cookie Stealer, IP Grabber, or Fake Roblox)";
        break;
      }
    }

    if (shouldBlock) break;

    // 4. Block any other link that is not TikTok or GIF
    if (lowerUrl.startsWith('http')) {
      shouldBlock = true;
      reason = "Only TikTok links and GIFs are allowed in this server.";
      break;
    }
  }

  if (shouldBlock) {
    try {
      // Delete message instantly
      await message.delete().catch(() => {});

      // Timeout for 10 minutes
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Posted blocked link: ${reason}`).catch(() => {});
      }

      // Send warning
      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Unsafe Link Blocked")
        .setDescription(`${message.author}, your message has been removed.`)
        .addFields(
          { name: "Reason", value: reason, inline: false },
          { name: "Allowed Links", value: "TikTok links and **any GIFs**", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });

      // Auto delete warning after 10 seconds
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} → ${reason}`);
    } catch (err) {
      console.error("[LINK BLOCKER ERROR]", err);
    }
  }
});

// ==================== ROLEALL COMMAND ====================
// Paste your full roleall code here (unchanged from previous versions)

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roleall") {
    // Your roleall code goes here...
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
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Bot - TikTok + All GIFs Allowed` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot is online!`);
console.log(`→ TikTok links allowed`);
console.log(`→ ALL GIF links allowed (no blocking)`);
console.log(`→ Everything else blocked + 10 min timeout`);
