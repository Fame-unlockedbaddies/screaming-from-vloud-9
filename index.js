console.log("BOOTING CLEAN BOT...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const WELCOME_CHANNEL = "1501637797273010242";
const TEST_ROLE_ID = "1497843975615283350";

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if bot is alive"),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message to send")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("testgreet")
    .setDescription("Test the welcome message")

].map(c => c.toJSON());

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

// ===== READY =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== WELCOME IMAGES =====
const welcomeImages = [
  "https://cdn.discordapp.com/attachments/1500287317531693129/1501633954283786381/ChatGPT_Image_May_6_2026_06_16_55_PM.png",
  "https://cdn.discordapp.com/attachments/1500287317531693129/1501634520271814727/ChatGPT_Image_May_6_2026_06_19_18_PM.png",
  "https://media.discordapp.net/attachments/1500287317531693129/1501635175547670801/ChatGPT_Image_May_6_2026_06_21_48_PM.png",
  "https://cdn.discordapp.com/attachments/1500287317531693129/1501636001079103518/ChatGPT_Image_May_6_2026_06_23_57_PM.png",
  "https://media.discordapp.net/attachments/1500287317531693129/1501636609500516412/ChatGPT_Image_May_6_2026_06_27_33_PM.png",
  "https://cdn.discordapp.com/attachments/1500287317531693129/1501637244392570971/ChatGPT_Image_May_6_2026_06_30_03_PM.png"
];

// ===== COMMAND HANDLER =====
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply("Pong");
  }

  if (interaction.commandName === "say") {
    const msg = interaction.options.getString("message");
    return interaction.reply(msg);
  }

  if (interaction.commandName === "testgreet") {

    if (!interaction.member.roles.cache.has(TEST_ROLE_ID)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true
      });
    }

    const randomImage = welcomeImages[Math.floor(Math.random() * welcomeImages.length)];
    const joinTime = Math.floor(Date.now() / 1000);

    const embed = {
      color: 0x96C396,
      title: "Welcome to Fame Community",
      description: `Welcome <@${interaction.user.id}>.\nWe are glad to have you here.\n\nJoined: <t:${joinTime}:R>`,
      thumbnail: {
        url: interaction.user.displayAvatarURL({ dynamic: true })
      },
      image: {
        url: randomImage
      },
      footer: {
        text: `Member #${interaction.guild.memberCount}`
      },
      timestamp: new Date()
    };

    return interaction.reply({
      content: "Preview",
      embeds: [embed],
      ephemeral: true
    });
  }

});

// ===== WELCOME SYSTEM =====
client.on(Events.GuildMemberAdd, async member => {

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!channel) return;

  const randomImage = welcomeImages[Math.floor(Math.random() * welcomeImages.length)];
  const joinTime = Math.floor(Date.now() / 1000);

  const embed = {
    color: 0x96C396,
    title: "Welcome to Fame Community",
    description: `Welcome <@${member.id}>.\nWe are glad to have you here.\n\nJoined: <t:${joinTime}:R>`,
    thumbnail: {
      url: member.user.displayAvatarURL({ dynamic: true })
    },
    image: {
      url: randomImage
    },
    footer: {
      text: `Member #${member.guild.memberCount}`
    },
    timestamp: new Date()
  };

  channel.send({
    content: `<@${member.id}>`,
    embeds: [embed]
  });

});

// ===== LOGIN =====
client.login(TOKEN);
