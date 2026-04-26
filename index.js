const http = require("http");
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
} = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = "YOUR_BOT_CLIENT_ID"; // 🔥 replace this
const PORT = process.env.PORT || 3000;

const ANNOUNCE_CHANNEL_ID = "1448798824415101030";
const MESSAGE_ROLE_ID = "1497255894096941076";
const UPGRADE_ROLE_ID = "1448796463491584060";

const WHITELIST_INVITES = [
  "discord.gg/yourcode",
  "discord.com/invite/yourcode"
];

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ===== SLASH COMMAND REGISTER =====
const commands = [
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by ID, tag, or mention")
    .addStringOption(option =>
      option.setName("user")
        .setDescription("User ID, tag, or mention")
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash command registered");
  } catch (err) {
    console.error(err);
  }
})();

// ===== STORAGE =====
const FILE = "./messageCounts.json";

function loadCounts() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE));
}

function saveCounts(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

let messageCounts = loadCounts();

// ===== ANTI DUPLICATE =====
const handledMessages = new Set();

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MESSAGE SYSTEM =====
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const userId = message.author.id;

  if (handledMessages.has(message.id)) return;
  handledMessages.add(message.id);
  setTimeout(() => handledMessages.delete(message.id), 5000);

  // ===== BLOCK INVITES =====
  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i;

  if (inviteRegex.test(message.content)) {
    const isWhitelisted = WHITELIST_INVITES.some(link =>
      message.content.toLowerCase().includes(link.toLowerCase())
    );

    if (isWhitelisted) return;

    try {
      await message.delete().catch(() => {});
      await message.member.timeout(5 * 60 * 1000);

      await message.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🚫 Invite Link Blocked")
            .setDescription("You were timed out for 5 minutes.")
            .setColor(0xff0000)
        ],
      }).catch(() => {});
    } catch (err) {
      console.error(err);
    }
    return;
  }

  const content = message.content;

  // ===== BATTLEGROUND =====
  if (/\bbattlegrounds?\b/i.test(content)) {
    await message.delete().catch(() => {});
    const msg = await message.channel.send({
      content: `<@${userId}> not that unkown game https://tenor.com/view/princessphobic-gif-19757314`,
      allowedMentions: { users: [userId] },
    });
    setTimeout(() => msg.delete().catch(() => {}), 3000);
    return;
  }

  // ===== TRUMP =====
  if (/\btrump\b/i.test(content)) {
    await message.delete().catch(() => {});
    const msg = await message.channel.send({
      content: `<@${userId}> ew u surport that thing- https://tenor.com/view/clbariz-gif-26347510`,
      allowedMentions: { users: [userId] },
    });
    setTimeout(() => msg.delete().catch(() => {}), 3000);
    return;
  }

  // ===== MESSAGE COUNT =====
  const member = message.member;
  const count = (messageCounts[userId] || 0) + 1;
  messageCounts[userId] = count;
  saveCounts(messageCounts);

  if (member.roles.cache.has(UPGRADE_ROLE_ID)) {
    if (member.roles.cache.has(MESSAGE_ROLE_ID)) {
      await member.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
    }
    return;
  }

  if (count >= 10 && !member.roles.cache.has(MESSAGE_ROLE_ID)) {
    await member.roles.add(MESSAGE_ROLE_ID).catch(console.error);

    const channel = message.guild.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setDescription(`🎉 <@${userId}> got the role!`)
      .setColor(0xff69b4);

    await channel.send({
      content: `<@${userId}>`,
      embeds: [embed],
    });
  }
});

// ===== SLASH COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "unban") {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const input = interaction.options.getString("user");

    try {
      const bans = await interaction.guild.bans.fetch();

      const ban = bans.find(b =>
        b.user.id === input ||
        `${b.user.username}#${b.user.discriminator}` === input ||
        `<@${b.user.id}>` === input
      );

      if (!ban) {
        return interaction.reply({ content: "❌ User not banned", ephemeral: true });
      }

      await interaction.guild.members.unban(ban.user.id);

      interaction.reply(`✅ Unbanned ${ban.user.tag}`);

    } catch (err) {
      console.error(err);
      interaction.reply({ content: "❌ Failed", ephemeral: true });
    }
  }
});

// ===== ROLE REMOVE =====
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (
    !oldMember.roles.cache.has(UPGRADE_ROLE_ID) &&
    newMember.roles.cache.has(UPGRADE_ROLE_ID)
  ) {
    if (newMember.roles.cache.has(MESSAGE_ROLE_ID)) {
      await newMember.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
    }
  }
});

// ===== KEEP ALIVE =====
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);

// ===== LOGIN =====
client.login(TOKEN);
