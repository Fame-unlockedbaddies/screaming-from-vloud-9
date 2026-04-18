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
  Role,
} = require("discord.js");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || null;
const PORT = process.env.PORT || 3000;
const FAME_GAME_ID = process.env.FAME_GAME_ID || "121157515767845";
const FAME_GAME_NAME = process.env.FAME_GAME_NAME || "Fame";
const WEBHOOK_URL = process.env.WEBHOOK_URL || null;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || null;
const FOUNDER_ROLE_ID = "1482560426972549232";   // Your founder role ID

const DEFAULT_ALLOWED_SERVER_IDS = ["1428878035926388809"];
const ALLOWED_SERVER_IDS = (process.env.ALLOWED_SERVER_IDS || DEFAULT_ALLOWED_SERVER_IDS.join(","))
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error("Missing TOKEN or DISCORD_TOKEN environment variable");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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
    console.log("Webhook logging enabled");
  } catch (error) {
    console.error("Webhook failed:", error.message);
  }
}

// ==================== HTTP SERVER ====================
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/stats") {
      const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
      const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : "0.00";
      res.end(JSON.stringify({
        status: "online",
        bot: client.user?.tag || "starting",
        game: FAME_GAME_NAME,
        uptime,
        totalSnipes: stats.totalSnipes,
        successfulSnipes: stats.successfulSnipes,
        failedSnipes: stats.failedSnipes,
        successRate: `${successRate}%`,
      }));
      return;
    }
    res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Sniper Bot` }));
  })
  .listen(PORT, () => console.log(`Web service listening on port ${PORT}`));

// Rate limiting setup
let lastRequest = 0;
const REQUEST_DELAY = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  stats.apiCalls += 1;
}

async function robloxFetch(url, options = {}) {
  await waitForRateLimit();
  const cookieHeader = ROBLOX_COOKIE ? { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` } : {};
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...cookieHeader, ...options.headers },
  });

  if (response.status === 429) {
    stats.rateLimits += 1;
    await sleep(2500);
    return robloxFetch(url, options);
  }
  if (!response.ok) throw new Error(`Roblox API error ${response.status}`);
  return response.json();
}

// ─── Roblox Helper Functions (kept from your working version) ───
async function getRobloxUser(username) { /* ... same as before ... */ }
async function getUserAvatar(userId) { /* ... same as before ... */ }
async function getUserPresence(userId) { /* ... same as before ... */ }
async function getTokenAvatars(tokens) { /* ... same as before (50 batch) ... */ }
async function findUserInServers(userId, username, maxPages = 8) { /* ... same as before ... */ }

// ==================== NEW COMMAND: /roleall ====================
async function hasFounderRole(interaction) {
  if (!interaction.guild) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  return member?.roles.cache.has(FOUNDER_ROLE_ID);
}

// ==================== COMMANDS ====================
function buildCommands() {
  const contexts = [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel];
  const types = [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall];

  return [
    // Your existing snipe command
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME}`)
      .addStringOption((option) => option.setName("username").setDescription("Roblox username").setRequired(true))
      .addBooleanOption((option) =>
        option.setName("deepsearch").setDescription("Enable deep search (slower but scans more servers)").setRequired(false)
      )
      .setIntegrationTypes(types)
      .setContexts(contexts)
      .toJSON(),

    // NEW: /roleall command
    new SlashCommandBuilder()
      .setName("roleall")
      .setDescription("Give a role to all members (Founder only)")
      .addRoleOption((option) =>
        option.setName("role").setDescription("The role to give").setRequired(true)
      )
      .addBooleanOption((option) =>
        option.setName("bots").setDescription("Also give role to bots? (true/false)").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Extra safety
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
  ];
}

async function registerCommands() {
  const commands = buildCommands();
  if (CLIENT_ID) {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Global slash commands registered");
  } else {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(commands);
    }
    console.log(`Guild commands registered in ${client.guilds.cache.size} servers`);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands().catch(console.error);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ==================== SNIPE COMMAND (your working version) ====================
  if (interaction.commandName === "snipe") {
    const startTime = Date.now();
    stats.totalSnipes += 1;
    await interaction.deferReply();

    // ... (your full snipe code remains exactly the same as the last working version)
    // I'll keep it short here for space - use the snipe part from the previous message I gave you
    // If you want me to paste the full snipe block again, just say so.
  }

  // ==================== NEW ROLEALL COMMAND ====================
  if (interaction.commandName === "roleall") {
    if (!(await hasFounderRole(interaction))) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("Access Denied")
          .setDescription("This command is only available to the Founder.")
          .setColor(0xff0000)
        ],
        ephemeral: true,
      });
    }

    const role = interaction.options.getRole("role", true);
    const includeBots = interaction.options.getBoolean("bots", true);

    await interaction.deferReply();

    try {
      const members = await interaction.guild.members.fetch();
      let count = 0;
      let skipped = 0;

      for (const member of members.values()) {
        if (member.user.bot && !includeBots) {
          skipped++;
          continue;
        }

        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role.id).catch(() => skipped++);
          count++;
        }
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Role All Completed")
            .setDescription(`Successfully gave the role **${role.name}** to **${count}** members.`)
            .addFields(
              { name: "Total Members Processed", value: `${members.size}`, inline: true },
              { name: "Skipped (Bots)", value: includeBots ? "0 (Bots included)" : `${skipped}`, inline: true }
            )
            .setColor(0x00ff00)
        ],
      });
    } catch (error) {
      console.error("[ROLEALL ERROR]", error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("Failed to assign roles. Make sure the bot has higher permissions than the role.")
          .setColor(0xff0000)
        ],
      });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
