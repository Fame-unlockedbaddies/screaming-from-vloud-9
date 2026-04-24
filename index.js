const http = require("http");
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

const ANNOUNCE_CHANNEL_ID = "1448798824415101030";
const MESSAGE_ROLE_ID = "1497255894096941076";
const UPGRADE_ROLE_ID = "1448796463491584060";

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

    console.log(`🎉 Giving role to ${message.author.tag}`);

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
      content: `<@${userId}>`, // 🔥 force tag
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
