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
    ) continue;

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerUrl)) {
        shouldBlock = true;
        reason = "Malicious link detected";
        break;
      }
    }
    if (shouldBlock) break;

    if (lowerUrl.startsWith('http')) {
      shouldBlock = true;
      reason = "Only TikTok links and GIFs are allowed.";
      break;
    }
  }

  if (shouldBlock) {
    try {
      await message.delete().catch(() => {});
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) await member.timeout(10 * 60 * 1000, reason).catch(() => {});

      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Allowed", value: "TikTok links and **any GIFs**" }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const msg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => msg.delete().catch(() => {}), 10000);
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
        sub.setName("hex").setDescription("Copy hex colors with preview")
          .addRoleOption(o => o.setName("role").setDescription("The role").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("emoji").setDescription("Copy emoji of a role")
          .addRoleOption(o => o.setName("role").setDescription("The role").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("all").setDescription("Copy colors + emoji")
          .addRoleOption(o => o.setName("role").setDescription("The role").setRequired(true))
      )
  ];

  await client.application.commands.set(commands);
  console.log("Commands registered.");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "copyrole") return;

  const sub = interaction.options.getSubcommand();
  const role = interaction.options.getRole("role");

  // Defer reply immediately to prevent timeout
  await interaction.deferReply().catch(() => {});

  try {
    if (sub === "hex") {
      let colorText = "No color set.";
      let previewHex = "2f3136";

      if (role.color) {
        const hex = `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText = `**Color:** \`${hex}\``;
        previewHex = role.color.toString(16).padStart(6, '0');
      }

      // Basic gradient support if available
      if (role.colors?.primaryColor) {
        const p = `#${role.colors.primaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText = `**Primary:** \`${p}\`\n`;
        previewHex = role.colors.primaryColor.toString(16).padStart(6, '0');
        if (role.colors.secondaryColor) {
          const s = `#${role.colors.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
          colorText += `**Secondary:** \`${s}\`\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎨 Role Colors — ${role.name}`)
        .setDescription(colorText)
        .setColor(role.color || 0x2f3136)
        .setThumbnail(`https://singlecolorimage.com/get/${previewHex}/400x400`)
        .addFields({ name: "Role ID", value: `\`${role.id}\`` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    else if (sub === "emoji") {
      const unicodeEmoji = role.unicodeEmoji;
      const hasIcon = !!role.icon;

      if (!unicodeEmoji && !hasIcon) {
        return interaction.editReply({ content: `❌ **${role.name}** has no emoji or custom icon.` });
      }

      let content = "";
      let desc = "";

      if (unicodeEmoji) {
        content = `**Emoji:** ${unicodeEmoji}`;
        desc = `**Unicode Emoji:** ${unicodeEmoji}\n\nHighlight it and copy (Ctrl + C)`;
      }

      if (hasIcon) {
        if (desc) desc += "\n\n";
        desc += "**Custom Icon:** Right-click the role icon in the member list or server settings → Copy Image.";
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Role Emoji — ${role.name}`)
        .setDescription(desc)
        .setColor(role.color || 0x2f3136)
        .setTimestamp();

      return interaction.editReply({ content: content || null, embeds: [embed] });
    }

    else if (sub === "all") {
      // Combine hex + emoji
      let colorText = "No color";
      let previewHex = "2f3136";

      if (role.color) {
        const hex = `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText = `**Color:** \`${hex}\``;
        previewHex = role.color.toString(16).padStart(6, '0');
      }

      let emojiText = "None";
      if (role.unicodeEmoji) emojiText = role.unicodeEmoji;
      else if (role.icon) emojiText = "Custom Icon (right-click to save)";

      const embed = new EmbedBuilder()
        .setTitle(`📋 Role Summary — ${role.name}`)
        .setDescription(`**Colors**\n${colorText}\n\n**Emoji/Icon**\n${emojiText}`)
        .setColor(role.color || 0x2f3136)
        .setThumbnail(`https://singlecolorimage.com/get/${previewHex}/400x400`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Command Error:", error);
    return interaction.editReply({ content: "❌ An error occurred while processing the command." }).catch(() => {});
  }
});

// ==================== ERROR HANDLING & SERVER ====================
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

client.login(TOKEN);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Bot` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot started!`);
