console.log("BOOTING ADVANCED PROTECTION BOT...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// ================= PROTECTED USER =================
const PROTECTED_USER_ID = "1497846804480524298";

// ================= KEEP ALIVE =================
const app = express();

app.get("/", (req, res) => {
  res.send("Advanced protection bot is online.");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server online.");
});

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ================= BLACKLIST =================
const blacklist = [

  // RACIAL SLURS
  "nigger",
  "chink",
  "coon",
  "spic",
  "wetback",
  "kike",
  "gook",
  "paki",
  "raghead",
  "beaner",
  "redskin",

  // LGBT / TRANS SLURS
  "faggot",
  "fag",
  "fggt",
  "tranny",
  "troon",
  "shemale",
  "dyke",
  "dike",
  "twink",
  "twinkie",
  "ponk",

  // SELF HARM
  "kys",
  "kms",
  "khs",
  "kill yourself",
  "killing myself",

  // SEXUAL WORDS
  "sex",
  "porn",
  "nudes",
  "boobs",
  "tits",
  "anal",
  "blowjob",
  "cock",
  "dick",
  "penis",
  "pussy",
  "cum",
  "horny",
  "masturbate",
  "jerking off",
  "slut",
  "whore",
  "ho",

  // SWEARING
  "fuck",
  "fucking",
  "fack",
  "bitch",
  "shit",
  "motherfucker",
  "bastard",
  "cunt",

  // OTHER
  "dog",
  "jerk"
];

// ================= EMBED WORDS =================
const embedWords = blacklist.filter(
  word =>
    word !== "dog" &&
    word !== "jerk" &&
    word !== "jerking off"
);

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("whatperioddoes")
    .setDescription("Displays blacklist system")
].map(command => command.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {

  try {

    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: commands
      }
    );

    console.log("Commands registered.");

  } catch (error) {
    console.error(error);
  }

})();

// ================= READY =================
client.once(Events.ClientReady, bot => {

  console.log(`Logged in as ${bot.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "Advanced Protection Active",
        type: 3
      }
    ],
    status: "dnd"
  });

});

// ================= SLASH COMMANDS =================
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    if (interaction.commandName === "whatperioddoes") {

      const rows = [];
      const wordsPerRow = 3;

      for (let i = 0; i < embedWords.length; i += wordsPerRow) {

        rows.push(
          embedWords
            .slice(i, i + wordsPerRow)
            .join("  ✦  ")
        );

      }

      const embed = new EmbedBuilder()

        .setColor("#ff1493")

        .setAuthor({
          name: "Advanced Moderation Database",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚡ Protection System")

        .setDescription(
          [
            "> Real-time blacklist monitoring enabled.",
            "",
            "```",
            rows.join("\n"),
            "```"
          ].join("\n")
        )

        .addFields(
          {
            name: "Status",
            value: "```diff\n+ Online\n```",
            inline: true
          },
          {
            name: "Auto Delete",
            value: "```yaml\nEnabled\n```",
            inline: true
          },
          {
            name: "DM Warnings",
            value: "```fix\nActive\n```",
            inline: true
          }
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({
          text: "Advanced Protection • Monitoring Active"
        })

        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

    }

  } catch (error) {
    console.error(error);
  }

});

// ================= MESSAGE FILTER =================
client.on(Events.MessageCreate, async message => {

  // IGNORE BOTS
  if (message.author.bot) return;

  // IGNORE EMPTY
  if (!message.content && message.attachments.size === 0) return;

  const content = (message.content || "").toLowerCase();

  try {

    // ================= IGNORE GIF LINKS =================
    const isGifMessage =
      content.includes("tenor.com") ||
      content.includes(".gif") ||
      content.includes("giphy.com") ||
      content.includes("media.discordapp.net");

    // ================= IM LEAVING =================
    if (
      !isGifMessage &&
      content.includes("im leaving")
    ) {

      await message.delete();

      const leaveEmbed = new EmbedBuilder()

        .setColor("#ff1493")

        .setAuthor({
          name: "Conversation Monitor",
          iconURL: client.user.displayAvatarURL()
        })

        .setDescription(
          `${message.author}\n\n> ok?`
        )

        .setFooter({
          text: "Automatic Response"
        })

        .setTimestamp();

      await message.channel.send({
        embeds: [leaveEmbed]
      });

      return;
    }

    // ================= MOMO FILTER =================
    if (
      !isGifMessage &&
      (
        content.includes("momo") ||
        (message.attachments.size > 0 &&
          [...message.attachments.values()].some(attachment =>
            attachment.name?.toLowerCase().includes("momo")
          ))
      )
    ) {

      await message.delete();

      const momoEmbed = new EmbedBuilder()

        .setColor("#ff1493")

        .setAuthor({
          name: "Content Protection",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚠ Restricted Content")

        .setDescription(
          [
            "> Your message was removed.",
            "",
            "```fix",
            "The word or GIF 'momo' is blocked.",
            "```"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({
          text: "Advanced Protection"
        })

        .setTimestamp();

      await message.author.send({
        embeds: [momoEmbed]
      });

      return;
    }

    // ================= PROTECTED USER =================
    if (message.mentions.users.has(PROTECTED_USER_ID)) {

      await message.delete();

      const protectedEmbed = new EmbedBuilder()

        .setColor("#ff1493")

        .setAuthor({
          name: "Protected User System",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚠ Mention Blocked")

        .setDescription(
          [
            "> Your message was removed.",
            "",
            "```yaml",
            "Fame is busy at this moment sorry.",
            "```"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({
          text: "Protected User Enabled"
        })

        .setTimestamp();

      await message.author.send({
        embeds: [protectedEmbed]
      });

      return;
    }

    // ================= IGNORE GIFS FOR BLACKLIST =================
    if (isGifMessage) return;

    // ================= SMART BLACKLIST FILTER =================

    // CONTENT WITH SPACES REMOVED
    const compactContent =
      content.replace(/\s+/g, "");

    // FIND BLOCKED WORD
    const foundWord = blacklist.find(word => {

      const compactWord =
        word.toLowerCase().replace(/\s+/g, "");

      // NORMAL CHECK
      if (
        content.includes(word.toLowerCase())
      ) {
        return true;
      }

      // SPACE BYPASS CHECK
      // EXAMPLE: d o g
      if (
        compactContent.includes(compactWord)
      ) {
        return true;
      }

      return false;

    });

    // ================= BLOCK MESSAGE =================
    if (foundWord) {

      await message.delete();

      const warningEmbed = new EmbedBuilder()

        .setColor("#ff1493")

        .setAuthor({
          name: "Advanced Moderation System",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚠ Message Removed")

        .setDescription(
          [
            "> Your message triggered the protection system.",
            "",
            "### Detected Word",
            `\`\`\`${foundWord}\`\`\``,
            "> Please avoid restricted language."
          ].join("\n")
        )

        .addFields(
          {
            name: "Status",
            value: "```diff\n- Removed\n```",
            inline: true
          },
          {
            name: "Warning",
            value: "```yaml\nDM Sent\n```",
            inline: true
          },
          {
            name: "Protection",
            value: "```fix\nActive\n```",
            inline: true
          }
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({
          text: "Advanced Protection • Online"
        })

        .setTimestamp();

      await message.author.send({
        embeds: [warningEmbed]
      });

      console.log(
        `Deleted message from ${message.author.tag} for using: ${foundWord}`
      );

      return;
    }

  } catch (error) {
    console.error("Moderation error:", error);
  }

});

// ================= LOGIN =================
client.login(TOKEN);
