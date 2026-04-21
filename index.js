const http = require("http");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  PermissionFlagsBits,
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
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ==================== LINK FILTER ====================

const tiktokRegex = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w-]+|Z[a-zA-Z0-9]+)/i;

const dangerousPatterns = [
  /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/i,
  /grabify\.link|iplogger\.org|ipgrabber|blasze\.com|trackip|myip\.is|ip-tracker/i,
  /roblox\.(com\.[a-z]{2,}|gg|app|site|xyz|fun|net|org|login|verify|gift|free|robux)/i,
  /rblx\.|rblox\.|robloxx?\.|free-robux|robux\.gift|getrobux/i,
  /cookie-logger|cookielogger|stealer|grabber|token-logger|beam\.link/i,
];

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.content.match(urlRegex) || [];

  let shouldBlock = false;
  let reason = "";

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();

    // Allowed GIF sources
    const isGiphy = lowerUrl.includes("giphy.com");
    const isTenor = lowerUrl.includes("tenor.com");
    const isDiscordCDN =
      lowerUrl.includes("cdn.discordapp.com") ||
      lowerUrl.includes("media.discordapp.net");

    // Klipy must contain "gif"
    const isKlipyGif =
      /^https?:\/\/(www\.)?klipy\.com\//i.test(url) &&
      lowerUrl.includes("gif");

    // ✅ Allowed
    if (
      tiktokRegex.test(url) ||
      isGiphy ||
      isTenor ||
      isDiscordCDN ||
      isKlipyGif
    ) continue;

    // 🚨 Dangerous links
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        shouldBlock = true;
        reason = "Malicious link detected";
        break;
      }
    }
    if (shouldBlock) break;

    // ❌ Block everything else
    if (lowerUrl.startsWith("http")) {
      shouldBlock = true;
      reason = "Only TikTok + GIFs (Giphy, Tenor, Discord, Klipy) allowed.";
      break;
    }
  }

  if (shouldBlock) {
    try {
      await message.delete().catch(() => {});

      const member = await message.guild.members.fetch(message.author.id).catch(() => null);

      if (member) {
        await member.timeout(10 * 60 * 1000, reason).catch(() => {});
      }

      // Public warning
      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Allowed", value: "TikTok + GIFs (Giphy, Tenor, Discord, Klipy)" }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const msg = await message.channel.send({ embeds: [warningEmbed] });

      // delete after 3 seconds
      setTimeout(() => msg.delete().catch(() => {}), 3000);

      // DM user
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle("⚠️ Moderation Notice")
          .setDescription(`Your message in **${message.guild.name}** was removed.`)
          .addFields(
            { name: "Reason", value: reason },
            { name: "Consequence", value: "10 minute timeout" }
          )
          .setColor(0xff0000)
          .setTimestamp();

        await message.author.send({ embeds: [dmEmbed] });
      } catch {
        // ignore if DMs closed
      }

    } catch (err) {
      console.error("[LINK ERROR]", err);
    }
  }
});

// ==================== SLASH COMMANDS ====================

client.once("ready", async () => {
  console.log(`${FAME_GAME_NAME} Bot is online!`);

  const commands = [
    new SlashCommandBuilder()
      .setName("copyrole")
      .setDescription("Advanced role copier")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub =>
        sub.setName("hex").setDescription("Copy hex colors")
          .addRoleOption(o => o.setName("role").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("emoji").setDescription("Copy emoji")
          .addRoleOption(o => o.setName("role").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("all").setDescription("Copy all")
          .addRoleOption(o => o.setName("role").setRequired(true))
      )
  ];

  await client.application.commands.set(commands);
  console.log("Commands registered.");
});

client.login(TOKEN);

http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);
