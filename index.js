const http = require("http");
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
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

  const userId = message.author.id;

  // ===== BLOCK DISCORD INVITES =====
  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i;

  if (inviteRegex.test(message.content)) {
    const isWhitelisted = WHITELIST_INVITES.some(link =>
      message.content.toLowerCase().includes(link.toLowerCase())
    );

    if (isWhitelisted) return;

    try {
      await message.delete().catch(() => {});
      await message.member.timeout(5 * 60 * 1000, "Posting Discord invite links");

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
      console.error(err);
    }

    return;
  }

  // ===== BLOCK "BATTLEGROUND(S)" WORD =====
  const bannedWords = ["battleground", "battlegrounds"];
  const contentLower = message.content.toLowerCase();

  if (bannedWords.some(word => contentLower.includes(word))) {
    try {
      await message.delete().catch(() => {});

      // ✅ SEND REAL GIF (NO LINK BUGS)
      const sentMsg = await message.channel.send({
        content: `<@${userId}> not that unkown game`,
        files: [
          "https://media.tenor.com/images/9b7c9c5bdf5c8b7b8f7d7c8d1e9b0c7c/tenor.gif"
        ],
        allowedMentions: { users: [userId] },
      });

      // ⏱ delete after 3 seconds
      setTimeout(() => {
        sentMsg.delete().catch(() => {});
      }, 3000);

    } catch (err) {
      console.error(err);
    }

    return;
  }

  // ===== MESSAGE COUNT SYSTEM =====
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
    }
  }
});

// ===== KEEP ALIVE =====
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);

// ===== LOGIN =====
client.login(TOKEN);
