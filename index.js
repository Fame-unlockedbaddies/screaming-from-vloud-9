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
        .addFields({ name: "Reason", value: reason }, { name: "Allowed", value: "TikTok & GIFs only" })
        .setColor(0xff0000)
        .setTimestamp();

      const msg = await message.channel.send({ embeds: [warningEmbed] });
      setTimeout(() => msg.delete().catch(() => {}), 10000);
    } catch (e) {}
  }
});

// ==================== COMMANDS ====================

client.once("ready", async () => {
  console.log(`${FAME_GAME_NAME} Bot is online!`);

  const commands = [
    new SlashCommandBuilder()
      .setName("copyrole")
      .setDescription("Advanced role copier")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(s => s.setName("hex").setDescription("Copy hex colors with preview").addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
      .addSubcommand(s => s.setName("emoji").setDescription("Copy emoji / download custom icon").addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
      .addSubcommand(s => s.setName("all").setDescription("Show everything (colors + emoji/icon)").addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
  ];

  await client.application.commands.set(commands);
  console.log("Advanced commands registered.");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "copyrole") return;

  await interaction.deferReply().catch(() => {});

  try {
    const sub = interaction.options.getSubcommand();
    const role = interaction.options.getRole("role");

    const baseColor = role.color || 0x2f3136;

    if (sub === "hex") {
      let desc = "No color set.";
      let previewHex = baseColor.toString(16).padStart(6, '0');

      if (role.color) {
        const hex = `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
        desc = `**Color:** \`${hex}\``;
      }

      // Gradient support
      if (role.colors?.primaryColor) {
        const p = `#${role.colors.primaryColor.toString(16).padStart(6, '0').toUpperCase()}`;
        desc = `**Primary:** \`${p}\`\n`;
        previewHex = role.colors.primaryColor.toString(16).padStart(6, '0');
        if (role.colors.secondaryColor) desc += `**Secondary:** \`#${role.colors.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
        if (role.colors.tertiaryColor) desc += `**Tertiary:** \`#${role.colors.tertiaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎨 Role Colors — ${role.name}`)
        .setDescription(desc)
        .setColor(baseColor)
        .setThumbnail(`https://singlecolorimage.com/get/${previewHex}/400x400`)
        .addFields({ name: "Role ID", value: `\`${role.id}\`` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    else if (sub === "emoji") {
      const unicodeEmoji = role.unicodeEmoji;
      const hasCustomIcon = !!role.icon;

      if (!unicodeEmoji && !hasCustomIcon) {
        return interaction.editReply({ content: `❌ **${role.name}** has no emoji or custom icon.` });
      }

      let content = "";
      let desc = "";
      const components = [];

      if (unicodeEmoji) {
        content = `**Emoji:** ${unicodeEmoji}`;
        desc = `**Unicode Emoji:** ${unicodeEmoji}\n\nHighlight and copy it.`;
      }

      if (hasCustomIcon) {
        const iconURL = role.iconURL({ extension: "png", size: 512 });

        if (desc) desc += "\n\n";
        desc += "**Custom Role Icon:**";

        const embed = new EmbedBuilder()
          .setTitle(`📋 Role Icon — ${role.name}`)
          .setDescription(desc)
          .setColor(baseColor)
          .setImage(iconURL)                    // ← Shows big preview of the icon
          .setTimestamp();

        // Download button
        const btn = new ButtonBuilder()
          .setLabel("⬇️ Download Icon")
          .setStyle(ButtonStyle.Link)
          .setURL(iconURL);

        components.push(new ActionRowBuilder().addComponents(btn));

        return interaction.editReply({ 
          content: content || null, 
          embeds: [embed], 
          components 
        });
      }

      // If only unicode emoji
      const embed = new EmbedBuilder()
        .setTitle(`📋 Role Emoji — ${role.name}`)
        .setDescription(desc)
        .setColor(baseColor)
        .setTimestamp();

      return interaction.editReply({ content, embeds: [embed] });
    }

    else if (sub === "all") {
      let colorDesc = "No color";
      let previewHex = baseColor.toString(16).padStart(6, '0');

      if (role.color) {
        colorDesc = `**Color:** \`#${role.color.toString(16).padStart(6, '0').toUpperCase()}\``;
      }
      if (role.colors?.primaryColor) {
        colorDesc = `**Primary:** \`#${role.colors.primaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
        previewHex = role.colors.primaryColor.toString(16).padStart(6, '0');
        if (role.colors.secondaryColor) colorDesc += `**Secondary:** \`#${role.colors.secondaryColor.toString(16).padStart(6, '0').toUpperCase()}\`\n`;
      }

      let emojiDesc = "None";
      const components = [];
      let imageURL = null;

      if (role.unicodeEmoji) {
        emojiDesc = role.unicodeEmoji;
      } else if (role.icon) {
        imageURL = role.iconURL({ extension: "png", size: 512 });
        emojiDesc = "Custom Icon (see preview below)";
        
        const btn = new ButtonBuilder()
          .setLabel("⬇️ Download Icon")
          .setStyle(ButtonStyle.Link)
          .setURL(imageURL);
        components.push(new ActionRowBuilder().addComponents(btn));
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Full Role Copy — ${role.name}`)
        .setDescription(`**Colors**\n${colorDesc}\n\n**Emoji / Icon**\n${emojiDesc}`)
        .setColor(baseColor)
        .setThumbnail(`https://singlecolorimage.com/get/${previewHex}/400x400`);

      if (imageURL) embed.setImage(imageURL);   // Shows the actual role icon big

      return interaction.editReply({ 
        embeds: [embed], 
        components: components.length ? components : [] 
      });
    }
  } catch (error) {
    console.error("Command Error:", error);
    interaction.editReply({ content: "❌ An error occurred. Please try again." }).catch(() => {});
  }
});

// ==================== SERVER & ERROR HANDLING ====================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Advanced Bot` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Advanced Bot started successfully!`);
