const http = require("http");
const {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  InteractionContextType,
  Partials,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  WebhookClient,
} = require("discord.js");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || null;
const PORT = process.env.PORT || 3000;
const FAME_GAME_ID = process.env.FAME_GAME_ID || "121157515767845";
const FAME_GAME_NAME = process.env.FAME_GAME_NAME || "Fame";
const WEBHOOK_URL = process.env.WEBHOOK_URL || null;
const FOUNDER_ROLE_ID = "1482560426972549232";

if (!TOKEN) {
  console.error("Missing TOKEN or DISCORD_TOKEN environment variable");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // Required for detecting links
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel],
});

const stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
};

let webhook = null;
if (WEBHOOK_URL) {
  try {
    webhook = new WebhookClient({ url: WEBHOOK_URL });
  } catch (e) {}
}

// ==================== DISCORD LINK BLOCKER ====================
const discordLinkRegex = /discord\.(gg|com|app)\/(invite\/)?[a-zA-Z0-9-]+/gi;

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Check if message contains Discord invite link
  if (discordLinkRegex.test(message.content)) {
    try {
      // Delete the message instantly
      await message.delete().catch(() => {});

      // Timeout the user for 10 minutes (600 seconds)
      const member = await message.guild.members.fetch(message.author.id);
      
      await member.timeout(10 * 60 * 1000, "Posted Discord invite link").catch(err => {
        console.log(`Failed to timeout user ${message.author.tag}:`, err.message);
      });

      // Send warning embed
      const warningEmbed = new EmbedBuilder()
        .setTitle("🚫 Discord Links Are Not Allowed")
        .setDescription(`${message.author}, you are not allowed to send Discord invite links in this server.`)
        .addFields(
          { name: "Action Taken", value: "Message deleted + 10 minute timeout", inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warningMsg = await message.channel.send({ embeds: [warningEmbed] });

      // Auto-delete warning after 10 seconds
      setTimeout(() => {
        warningMsg.delete().catch(() => {});
      }, 10000);

      console.log(`[LINK BLOCKED] ${message.author.tag} was timed out for posting a Discord link.`);
    } catch (error) {
      console.error("[LINK BLOCKER ERROR]", error);
    }
  }
});

// ==================== ROLEALL COMMAND ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roleall") {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member || !member.roles.cache.has(FOUNDER_ROLE_ID)) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("Access Denied")
          .setDescription("Only the Founder can use this command.")
          .setColor(0xff0000)
        ],
        ephemeral: true
      });
    }

    const role = interaction.options.getRole("role", true);
    const includeBots = interaction.options.getBoolean("bots", true);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Starting Role Assignment")
          .setDescription(`Giving **${role.name}** to all members...\nBots included: ${includeBots ? "Yes" : "No"}`)
          .setColor(0x5865f2)
      ]
    });

    try {
      const members = await interaction.guild.members.fetch();
      let assigned = 0;
      let skipped = 0;

      for (const m of members.values()) {
        if (m.user.bot && !includeBots) {
          skipped++;
          continue;
        }

        if (!m.roles.cache.has(role.id)) {
          try {
            await m.roles.add(role.id);
            assigned++;

            const progressEmbed = new EmbedBuilder()
              .setTitle("📋 Assigning Roles...")
              .setDescription(`**Assigned to:** ${m.user} (${m.user.tag})`)
              .addFields(
                { name: "Progress", value: `${assigned} assigned | ${skipped} skipped`, inline: true },
                { name: "Role", value: role.name, inline: true }
              )
              .setColor(0x00ff00)
              .setTimestamp();

            await interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});
            await sleep(400);
          } catch (err) {
            skipped++;
            console.log(`Failed to give role to ${m.user.tag}`);
          }
        } else {
          skipped++;
        }
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Role Assignment Complete")
            .setDescription(`Successfully gave **${role.name}** to **${assigned}** members.`)
            .addFields(
              { name: "Total Members", value: `${members.size}`, inline: true },
              { name: "Assigned", value: `${assigned}`, inline: true },
              { name: "Skipped", value: `${skipped}`, inline: true }
            )
            .setColor(0x00ff00)
        ]
      });
    } catch (error) {
      console.error("[ROLEALL ERROR]", error);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle("❌ Error").setDescription("An error occurred while assigning roles.").setColor(0xff0000)]
      });
    }
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
  res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Sniper Bot` }));
}).listen(PORT);

console.log(`${FAME_GAME_NAME} Bot is now online! Discord link blocker is active.`);
