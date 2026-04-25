const http = require("http");
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

const ANNOUNCE_CHANNEL_ID = "1448798824415101030";
const MESSAGE_ROLE_ID = "1497255894096941076";
const UPGRADE_ROLE_ID = "1448796463491584060";

// ✅ WHITELIST YOUR INVITE(S)
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

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MESSAGE SYSTEM =====
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ===== BLOCK DISCORD INVITES =====
  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i;

  if (inviteRegex.test(message.content)) {

    // ✅ Check whitelist
    const isWhitelisted = WHITELIST_INVITES.some(link =>
      message.content.toLowerCase().includes(link.toLowerCase())
    );

    if (isWhitelisted) return;

    console.log(`🚫 Invite link detected from ${message.author.tag}`);

    try {
      // Delete message
      await message.delete().catch(() => {});

      // Timeout for 5 minutes
      await message.member.timeout(5 * 60 * 1000, "Posting Discord invite links");

      // DM user
      await message.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🚫 Invite Link Blocked")
            .setDescription(
              `Your message in **${message.guild.name}** was removed because it contained a Discord invite link.\n\n` +
              `⏱ You have been timed out for **5 minutes**.`
            )
            .setColor(0xff0000)
            .setTimestamp(),
        ],
      }).catch(() => {});

    } catch (err) {
      console.error("❌ Error handling invite link:", err);
    }

    return;
  }

  // ===== BLOCK "BATTLEGROUND(S)" WORD =====
  const bannedWords = ["battleground", "battlegrounds"];
  const contentLower = message.content.toLowerCase();

  if (bannedWords.some(word => contentLower.includes(word))) {
    console.log(`🚫 Banned word detected from ${message.author.tag}`);

    try {
      // Delete message
      await message.delete().catch(() => {});

      // Send embed + GIF
      const embed = new EmbedBuilder()
        .setDescription(`ew not that ho <@${message.author.id}>`)
        .setColor(0xff69b4)
        .setTimestamp();

      await message.channel.send({
        content: `<@${message.author.id}>`,
        embeds: [embed],
        files: [
          "https://tenor.com/view/princessphobic-gif-19757314"
        ],
        allowedMentions: {
          users: [message.author.id],
        },
      });

    } catch (err) {
      console.error("❌ Error handling banned word:", err);
    }

    return;
  }

  console.log("📩 Message from:", message.author.tag);

  const userId = message.author.id;
  const member = message.member;

  // Count messages
  const count = (messageCounts[userId] || 0) + 1;
  messageCounts[userId] = count;
  saveCounts(messageCounts);

  console.log(`${message.author.tag} -> ${count} messages`);

  // Remove role if upgraded
  if (member.roles.cache.has(UPGRADE_ROLE_ID)) {
    if (member.roles.cache.has(MESSAGE_ROLE_ID)) {
      await member.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
      console.log(`❌ Removed role from ${message.author.tag}`);
    }
    return;
  }

  // Give role at 10 messages
  if (count >= 10 && !member.roles.cache.has(MESSAGE_ROLE_ID)) {

    console.log(` Giving role to ${message.author.tag}`);

    await member.roles.add(MESSAGE_ROLE_ID).catch(console.error);

    const channel = message.guild.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!channel) return console.log("❌ Channel not found");

    const role = message.guild.roles.cache.get(MESSAGE_ROLE_ID);

    const embed = new EmbedBuilder()
      .setDescription(
        `🎉 <@${userId}> you have received this role <@&${MESSAGE_ROLE_ID}>\n` +
        `You have received the Fame Newgen role!`
      )
      .setColor(0xff69b4)
      .setThumbnail(role?.iconURL())
      .setTimestamp();

    await channel.send({
      content: `<@${userId}>`,
      embeds: [embed],
      allowedMentions: {
        users: [userId],
        roles: [MESSAGE_ROLE_ID],
      },
    });
  }
});

// ===== REMOVE ROLE IF UPGRADED =====
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (
    !oldMember.roles.cache.has(UPGRADE_ROLE_ID) &&
    newMember.roles.cache.has(UPGRADE_ROLE_ID)
  ) {
    if (newMember.roles.cache.has(MESSAGE_ROLE_ID)) {
      await newMember.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
      console.log(`❌ Auto removed role from ${newMember.user.tag}`);
    }
  }
});

// ===== KEEP ALIVE =====
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);

// ===== LOGIN =====
client.login(TOKEN);
