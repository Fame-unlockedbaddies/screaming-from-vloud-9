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

// ==================== MALICIOUS LINK DETECTION ====================

// TikTok allowed domains
const allowedTikTok = /tiktok\.com|vm\.tiktok\.com/i;

// Common dangerous patterns
const dangerousPatterns = [
  // Discord invites (still blocked)
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,

  // IP Grabbers & Loggers (Grabify + common alternatives)
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|ps3cfw\.com|trackip|myip\.is|ip-tracker|grabify|cliip\.net|linklog|redir\.me/i,

  // Fake Roblox / Cookie Stealer domains (common phishing patterns)
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|robloxapp|roblox\.com\./i,
  /free-robux|robux\.gift|getrobux|roblox\.gift/i,

  // Other common stealer / phishing indicators
  /cookie-logger|cookielogger|beamer|beam\.link|stealer|grabber|token-logger/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  // Check for any URL in the message
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];

  let isBadLink = false;
  let reason = "";

  for (const url of urls) {
    if (allowedTikTok.test(url)) {
      continue; // TikTok is allowed
    }

    // Check against dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(url)) {
        isBadLink = true;
        reason = "Malicious / Unsafe link detected (Cookie Stealer, IP Grabber, or Fake Roblox)";
        break;
      }
    }

    if (isBadLink) break;

    // Block any other non-TikTok links
    if (url.includes("http") || url.includes("www.")) {
      isBadLink = true;
      reason = "Only TikTok links are allowed in this server.";
      break;
    }
  }

  if (isBadLink) {
    try {
      // Delete message instantly
      await message.delete().catch(() => {});

      // Timeout user for 10 minutes
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Posted unsafe link: ${reason}`).catch(() => {});
      }

      // Warning embed
      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Unsafe Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason, inline: false },
          { name: "Action", value: "10-minute timeout applied", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });

      // Auto-delete warning
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} - ${reason}`);
    } catch (err) {
      console.error("[LINK BLOCKER ERROR]", err);
    }
  }
});

// ==================== ROLEALL COMMAND (unchanged) ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roleall") {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member || !member.roles.cache.has(FOUNDER_ROLE_ID)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Access Denied").setDescription("Only the Founder can use this command.").setColor(0xff0000)],
        ephemeral: true
      });
    }

    // ... (your existing roleall code remains the same)
    // Paste your full roleall logic here if you want it included
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
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Sniper Bot - Link Protector Active` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot online! Only TikTok links allowed. Malicious links (cookie stealers, fake roblox, ip grabbers) are blocked.`);
