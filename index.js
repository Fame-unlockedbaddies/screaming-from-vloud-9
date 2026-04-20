const http = require("http");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
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

    if (tiktokRegex.test(url)) continue;

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

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        shouldBlock = true;
        reason = "Malicious link (Cookie Stealer, IP Grabber, or Fake Roblox)";
        break;
      }
    }
    if (shouldBlock) break;

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
          { name: "Reason", value: reason },
          { name: "Allowed Links", value: "TikTok links and **any GIFs**" }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);
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
  console.log(`→ Other links blocked + 10 min timeout`);

  const commands = [
    new SlashCommandBuilder()
      .setName("copyrole")
      .setDescription("Copy role colors or emoji/icon")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub =>
        sub
          .setName("hex")
          .setDescription("Copy the hex color(s) of a role (supports gradients)")
          .addRoleOption(option => option.setName("role").setDescription("The role").setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName("emoji")
          .setDescription("Copy the emoji or download custom icon of a role")
          .addRoleOption(option => option.setName("role").setDescription("The role").setRequired(true))
      )
  ];

  await client.application.commands.set(commands);
  console.log("Slash commands registered successfully.");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "copyrole") return;

  const sub = interaction.options.getSubcommand();
  const role = interaction.options.getRole("role");

  // ====================== /copyrole hex ======================
  if (sub === "hex") {
    let colorText = "";

    // Gradient roles support
    if (role.colors && (role.colors.primaryColor || role.colors.secondaryColor || role.colors.tertiaryColor)) {
      const c = role.colors;
      if (c.primaryColor) {
        const p = `#${c.primaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Primary:** \`${p}\`\n`;
      }
      if (c.secondaryColor) {
        const s = `#${c.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Secondary:** \`${s}\`\n`;
      }
      if (c.tertiaryColor) {
        const t = `#${c.tertiaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Tertiary:** \`${t}\`\n`;
      }
    } 
    else if (role.color) {
      const hex = `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
      colorText = `**Color:** \`${hex}\``;
    } 
    else {
      colorText = "This role has no color set.";
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎨 Role Colors — ${role.name}`)
      .setDescription(colorText)
      .setColor(role.color || 0x2f3136)
      .addFields({ name: "Role ID", value: `\`${role.id}\`` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ====================== /copyrole emoji ======================
  else if (sub === "emoji") {
    const unicodeEmoji = role.unicodeEmoji;
    const hasCustomIcon = !!role.icon;

    if (!unicodeEmoji && !hasCustomIcon) {
      return interaction.reply({
        content: `❌ **${role.name}** has neither an emoji nor a custom icon.`,
        ephemeral: true
      });
    }

    let replyContent = "";
    let embedDesc = "";
    const components = [];

    if (unicodeEmoji) {
      replyContent = `**Emoji for ${role.name}:** ${unicodeEmoji}`;
      embedDesc = `**Unicode Emoji:** ${unicodeEmoji}\n\n→ Highlight the emoji above and copy it (Ctrl + C)`;
    }

    if (hasCustomIcon) {
      const iconURL = role.iconURL({ extension: 'png', size: 512 });

      if (embedDesc) embedDesc += "\n\n";
      embedDesc += `**Custom Role Icon:**\n[View Full Size](${iconURL})`;

      const downloadBtn = new ButtonBuilder()
        .setLabel("⬇️ Download Icon Image")
        .setStyle(ButtonStyle.Link)
        .setURL(iconURL);

      components.push(new ActionRowBuilder().addComponents(downloadBtn));
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Role Emoji / Icon — ${role.name}`)
      .setDescription(embedDesc || "No additional information.")
      .setColor(role.color || 0x2f3136)
      .setTimestamp();

    return interaction.reply({
      content: replyContent || null,
      embeds: [embed],
      components: components
    });
  }
});

// ==================== ERROR HANDLING & HTTP SERVER ====================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    status: "online", 
    message: `${FAME_GAME_NAME} Bot - TikTok + GIFs Allowed` 
  }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot started successfully!`);
