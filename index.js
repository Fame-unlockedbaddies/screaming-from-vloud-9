
const http = require("http");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// ================= SESSION STORAGE (RESETS ON RESTART) =================
const acceptedUsers = new Set();


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

    const isGiphy = lowerUrl.includes("giphy.com");
    const isTenor = lowerUrl.includes("tenor.com");
    const isDiscordCDN =
      lowerUrl.includes("cdn.discordapp.com") ||
      lowerUrl.includes("media.discordapp.net");

    const isKlipyGif =
      /^https?:\/\/(www\.)?klipy\.com\//i.test(url) &&
      lowerUrl.includes("gif");

    if (
      tiktokRegex.test(url) ||
      isGiphy ||
      isTenor ||
      isDiscordCDN ||
      isKlipyGif
    ) continue;

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        shouldBlock = true;
        reason = "Malicious link detected";
        break;
      }
    }

    if (shouldBlock) break;

    if (lowerUrl.startsWith("http")) {
      shouldBlock = true;
      reason = "Only TikTok + GIFs allowed.";
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

      const embed = new EmbedBuilder()
        .setTitle("🚫 Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Allowed", value: "TikTok + GIFs only" }
        )
        .setColor(0xff0000);

      const msg = await message.channel.send({ embeds: [embed] });
      setTimeout(() => msg.delete().catch(() => {}), 3000);

    } catch (err) {
      console.error(err);
    }
  }
});


// ==================== COMMANDS ====================
client.once("ready", async () => {
  console.log(`${FAME_GAME_NAME} Bot is online!`);

  const commands = [
    new SlashCommandBuilder()
      .setName("fame")
      .setDescription("Fame system")
      .addSubcommand(sub =>
        sub.setName("upcoming")
          .setDescription("Access Fame upcoming system")
      )
  ];

  await client.application.commands.set(commands);
  console.log("Commands registered.");
});


// ==================== INTERACTIONS ====================
client.on("interactionCreate", async (interaction) => {

  // ===== SLASH COMMAND =====
  if (interaction.isChatInputCommand()) {
    if (
      interaction.commandName === "fame" &&
      interaction.options.getSubcommand() === "upcoming"
    ) {

      const userId = interaction.user.id;

      const embed = new EmbedBuilder()
        .setTitle("🌸 Fame Access Portal")
        .setDescription(
          "**Exclusive Fame System**\n\n" +
          "Gain access to:\n" +
          "• Upcoming updates\n" +
          "• Leaks & previews\n" +
          "• New systems & items\n\n" +
          "**Accept the Terms of Service to continue.**"
        )
        .setColor(0xff69b4)
        .setFooter({ text: "Fame Access System" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`fame_accept_${userId}`)
          .setLabel("Accept TOS")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`fame_decline_${userId}`)
          .setLabel("Decline")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    const ownerId = interaction.customId.split("_")[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Run `/fame upcoming` yourself.",
        ephemeral: true,
      });
    }

    // ===== ACCEPT =====
    if (interaction.customId.startsWith("fame_accept")) {

      acceptedUsers.add(interaction.user.id);

      await interaction.message.delete().catch(() => {});

      const confirmEmbed = new EmbedBuilder()
        .setTitle("✅ Access Granted")
        .setDescription(`${interaction.user} has accepted the TOS.`)
        .setColor(0x00ff88);

      await interaction.channel.send({ embeds: [confirmEmbed] });

      // ===== DM =====
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle("✨ Welcome to Fame")
          .setDescription(
            `Hello ${interaction.user},\n\n` +
            "**You now have exclusive access.**\n\n" +
            "You will receive:\n" +
            "• Leaks\n" +
            "• Upcoming events\n" +
            "• Items & systems\n\n" +
            "Stay ready."
          )
          .setColor(0xff69b4)
          .setFooter({ text: "Fame System" })
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });
      } catch {}

    }

    // ===== DECLINE =====
    if (interaction.customId.startsWith("fame_decline")) {
      await interaction.message.delete().catch(() => {});
    }
  }
});


client.login(TOKEN);


// ==================== SERVER ====================
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);
