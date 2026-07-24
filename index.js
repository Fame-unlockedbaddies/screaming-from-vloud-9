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
const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

const dangerousWords = [
  "grabify", "iplogger", "ipgrabber", "blasze", "trackip", "myip.is", "ip-tracker",
  "roblox login", "free robux", "robux gift", "rblx", "rblox",
  "cookie logger", "cookielogger", "token logger", "stealer", "grabber", "beam.link",
  "nitro gift", "discord gift", "dox", "doxx", "ip logger", "ip grabber"
];

const dangerousRegex = new RegExp(dangerousWords.join("|"), "i");

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.content.match(urlRegex) || [];

  let shouldBlock = false;
  let reason = "";

  // Check URLs first
  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    if (tiktokRegex.test(url)) continue;

    if (
      lowerUrl.endsWith('.gif') ||
      lowerUrl.includes('tenor.com') ||
      lowerUrl.includes('giphy.com') ||
      lowerUrl.includes('cdn.discordapp.com') ||
      lowerUrl.includes('media.discordapp.net') ||
      lowerUrl.includes('imgur.com')
    ) continue;

    // Block other links
    shouldBlock = true;
    reason = "Only TikTok links and GIFs are allowed.";
    break;
  }

  // Check for dangerous words anywhere in the message
  if (!shouldBlock && dangerousRegex.test(content)) {
    shouldBlock = true;
    reason = "Potential doxxing / IP grabber / stealer words detected";
  }

  if (shouldBlock) {
    try {
      await message.delete().catch(() => {});

      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, reason).catch(() => {});
      }

      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Safety Protection Activated")
        .setDescription(`${message.author}, your message has been removed.`)
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

// ==================== UPTIME SERVER ====================
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    status: "online", 
    message: `${FAME_GAME_NAME} Anti-Doxx Bot` 
  }));
}).listen(PORT);

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

console.log(`${FAME_GAME_NAME} Anti-Doxx Bot is running!`);
console.log("→ Detects dangerous words + links");
console.log("→ Protects against doxxing / IP grabbers");
