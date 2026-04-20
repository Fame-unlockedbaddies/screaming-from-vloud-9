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
      if (member) {
        await member.timeout(10 * 60 * 1000, reason).catch(() => {});
      }

      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Link Blocked")
        .setDescription(`${message.author}, your message was removed.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Allowed", value: "TikTok links and **any GIFs**" }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => warningMsg.delete().catch(() => {}), 10000);
    } catch (err) {
      console.error("[LINK ERROR]", err);
    }
  }
});

// ==================== SLASH COMMANDS ====================

client.once("ready", async () => {
  console.log(`${FAME_GAME_NAME} Bot is fully online!`);

  const commands = [
    new SlashCommandBuilder()
      .setName("copyrole")
      .setDescription("Advanced role information copier")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub => 
        sub.setName("hex").setDescription("Copy hex colors with preview (supports gradients)")
          .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
      .addSubcommand(sub => 
        sub.setName("emoji").setDescription("Copy emoji or view custom icon")
          .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
      .addSubcommand(sub => 
        sub.setName("all").setDescription("Copy everything: colors + emoji/icon")
          .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
      .addSubcommand(sub => 
        sub.setName("info").setDescription("Full detailed role information")
          .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
  ];

  await client.application.commands.set(commands);
  console.log("Advanced /copyrole commands registered.");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "copyrole") return;

  const sub = interaction.options.getSubcommand();
  const role = interaction.options.getRole("role");

  const baseEmbed = new EmbedBuilder()
    .setAuthor({ name: role.name, iconURL: role.iconURL() || null })
    .setColor(role.color || 0x2f3136)
    .setTimestamp();

  // ====================== HEX ======================
  if (sub === "hex") {
    let colorText = "";
    let previewColor = role.color || 0x2f3136;

    if (role.colors) {
      const c = role.colors;
      if (c.primaryColor) {
        const p = `#${c.primaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Primary:** \`${p}\`\n`;
        previewColor = c.primaryColor;
      }
      if (c.secondaryColor) {
        const s = `#${c.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Secondary:** \`${s}\`\n`;
      }
      if (c.tertiaryColor) {
        const t = `#${c.tertiaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        colorText += `**Tertiary:** \`${t}\`\n`;
      }
    } else if (role.color) {
      const hex = `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
      colorText = `**Solid Color:** \`${hex}\``;
    } else {
      colorText = "No color set.";
    }

    const embed = baseEmbed
      .setTitle("🎨 Role Colors")
      .setDescription(colorText)
      .setThumbnail(`https://singlecolorimage.com/get/${previewColor.toString(16).padStart(6, '0')}/400x400`)
      .addFields({ name: "Role ID", value: `\`${role.id}\`` });

    return interaction.reply({ embeds: [embed] });
  }

  // ====================== EMOJI ======================
  else if (sub === "emoji") {
    const unicode = role.unicodeEmoji;
    const hasIcon = !!role.icon;

    if (!unicode && !hasIcon) {
      return interaction.reply({ content: `❌ **${role.name}** has no emoji or icon.`, ephemeral: true });
    }

    let desc = "";
    let content = "";

    if (unicode) {
      content = `**Emoji:** ${unicode}`;
      desc = `**Unicode Emoji:** ${unicode}\n\nHighlight above and copy (Ctrl+C)`;
    }

    if (hasIcon) {
      if (desc) desc += "\n\n";
      desc += "**Custom Icon:** Right-click the role in member list or server settings → Copy Image to save.";
    }

    const embed = baseEmbed.setTitle("📋 Role Emoji / Icon").setDescription(desc);
    return interaction.reply({ content: content || null, embeds: [embed] });
  }

  // ====================== ALL ======================
  else if (sub === "all") {
    let colorText = "No color";
    let previewColor = role.color || 0x2f3136;

    if (role.colors) {
      const c = role.colors;
      colorText = "";
      if (c.primaryColor) {
        colorText += `Primary: \`#${c.primaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
        previewColor = c.primaryColor;
      }
      if (c.secondaryColor) colorText += `Secondary: \`#${c.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
      if (c.tertiaryColor) colorText += `Tertiary: \`#${c.tertiaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
    } else if (role.color) {
      colorText = `Solid: \`#${role.color.toString(16).padStart(6, '0').toUpperCase()}\``;
    }

    let emojiText = "None";
    if (role.unicodeEmoji) emojiText = role.unicodeEmoji;
    else if (role.icon) emojiText = "Custom Icon (see below)";

    const embed = baseEmbed
      .setTitle(`📋 Full Role Info — ${role.name}`)
      .setDescription(`**Colors:**\n${colorText}\n\n**Emoji/Icon:** ${emojiText}`)
      .setThumbnail(`https://singlecolorimage.com/get/${previewColor.toString(16).padStart(6, '0')}/400x400`);

    if (role.icon) {
      embed.addFields({ name: "Custom Icon", value: "Right-click role → Copy Image to download" });
    }

    return interaction.reply({ embeds: [embed] });
  }

  // ====================== INFO ======================
  else if (sub === "info") {
    const memberCount = role.members.size;
    const permCount = role.permissions.toArray().length;

    const embed = baseEmbed
      .setTitle(`ℹ️ Detailed Role Info — ${role.name}`)
      .addFields(
        { name: "Role ID", value: `\`${role.id}\``, inline: true },
        { name: "Position", value: `${role.position}`, inline: true },
        { name: "Color", value: role.color ? `#${role.color.toString(16).padStart(6, '0').toUpperCase()}` : "None", inline: true },
        { name: "Members", value: `${memberCount}`, inline: true },
        { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true },
        { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
        { name: "Permissions", value: `${permCount} permissions`, inline: true }
      );

    if (role.unicodeEmoji) embed.addFields({ name: "Emoji", value: role.unicodeEmoji, inline: true });
    if (role.icon) embed.addFields({ name: "Custom Icon", value: "Available — right-click to save" });

    return interaction.reply({ embeds: [embed] });
  }
});

// ==================== ERROR HANDLING & UPTIME ====================
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

client.login(TOKEN);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", bot: `${FAME_GAME_NAME} Advanced Role Copier` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Advanced Bot started!`);
