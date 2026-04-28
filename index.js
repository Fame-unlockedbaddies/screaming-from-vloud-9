const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 Web server (Render requirement)
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🔐 ENV
const TOKEN = process.env.TOKEN;

// 🤖 Bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // IMPORTANT for roles
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

// 🔑 Code + Role
const ACCESS_CODE = "charlie3026";
const ROLE_ID = "1497255894096941076";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 💬 Command
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!backup") {
    try {
      await message.author.send("📋 Backup Form\nPlease enter your access code:");

      const filter = (m) => m.author.id === message.author.id;
      const dmChannel = await message.author.createDM();

      const collector = dmChannel.createMessageCollector({
        filter,
        time: 30000,
        max: 1
      });

      collector.on("collect", async (msg) => {
        if (msg.content === ACCESS_CODE) {
          try {
            // Get member from guild
            const guild = message.guild;
            const member = await guild.members.fetch(message.author.id);

            // Add role
            await member.roles.add(ROLE_ID);

            msg.reply("✅ You have accessed the highest role.\nThank you for using backup!\nMade by Fame");
          } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to assign role. Check bot permissions and role position.");
          }
        } else {
          msg.reply("❌ Incorrect code. Access denied.");
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          message.author.send("⌛ You didn’t enter a code in time.");
        }
      });

    } catch (err) {
      message.reply("❌ I couldn't DM you. Please enable DMs.");
    }
  }
});

// 🚀 Login
client.login(TOKEN);
