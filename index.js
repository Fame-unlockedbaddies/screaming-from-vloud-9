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

    // 1. Allow TikTok links
    if (tiktokRegex.test(url)) continue;

    // 2. Completely ignore ALL GIF links
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
      await message.delete().catch(() => {});

      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        await member.timeout(10 * 60 * 1000, `Posted blocked link: ${reason}`).catch(() => {});
      }

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
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} → ${reason}`);
    } catch (err) {
      console.error("[LINK BLOCKER ERROR]", err);
    }
  }
});

// ==================== SLASH COMMANDS ====================

client.once("ready", async () => {
  console.log(`${FAME_GAME_NAME} Bot is online!`);
  console.log(`→ TikTok links allowed`);
  console.log(`→ ALL GIF links allowed`);
  console.log(`→ Everything else blocked + 10 min timeout`);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName("copyrole")
      .setDescription("Copy role information")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub =>
        sub
          .setName("hex")
          .setDescription("Copy the hex color(s) of a role")
          .addRoleOption(option =>
            option.setName("role").setDescription("The role to copy colors from").setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName("emoji")
          .setDescription("Copy the emoji of a role")
          .addRoleOption(option =>
            option.setName("role").setDescription("The role to copy emoji from").setRequired(true)
          )
      )
  ];

  await client.application.commands.set(commands);
  console.log("Slash commands registered: /copyrole hex and /copyrole emoji");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "copyrole") {
    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole("role");

    if (subcommand === "hex") {
      // Get role colors
      const color = role.color ? `#${role.color.toString(16).padStart(6, '0').toUpperCase()}` : "No color (transparent)";

      // For gradient roles (Discord supports up to 2 colors in some cases via unicode emoji tricks, but usually 1)
      // We'll show the main color + note if it's a gradient role
      let description = `**Main Color:** ${color}`;

      if (role.icon) {
        description += `\n**Note:** This role has a custom icon.`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎨 Role Colors - ${role.name}`)
        .setDescription(description)
        .setColor(role.color || 0x2f3136)
        .addFields(
          { name: "Hex Code", value: `\`${color}\``, inline: true },
          { name: "Role ID", value: `\`${role.id}\``, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    else if (subcommand === "emoji") {
      if (!role.unicodeEmoji && !role.icon) {
        return interaction.reply({
          content: `❌ The role **${role.name}** has no emoji or icon.`,
          ephemeral: true
        });
      }

      let emojiText = "";

      if (role.unicodeEmoji) {
        emojiText = role.unicodeEmoji;
      } else if (role.icon) {
        emojiText = `[Custom Icon] (Cannot be copied as text)`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Role Emoji - ${role.name}`)
        .setDescription(`**Emoji:** ${emojiText}`)
        .setColor(role.color || 0x2f3136)
        .addFields({ name: "Role Name", value: role.name, inline: true })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        content: role.unicodeEmoji ? `**Copied Emoji:** ${role.unicodeEmoji}` : undefined
      });
    }
  }

  // Add your old /roleall command here if you still want it
  // if (interaction.commandName === "roleall") { ... }
});

// ==================== ERROR HANDLING ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

// HTTP Server for uptime monitoring
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    status: "online", 
    message: `${FAME_GAME_NAME} Bot - TikTok + All GIFs Allowed` 
  }));
}).listen(PORT);
