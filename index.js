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

// USER TO PROTECT
const PROTECTED_USER_ID = "1497846804480524298";

// ALLOWED DOG GIF
const ALLOWED_DOG_GIF =
  "https://tenor.com/view/h2di-dog-side-eye-awkward-gif-7599485883499901089";

// ================= KEEP ALIVE =================
const app = express();

app.get("/", (req, res) => {
  res.send("Advanced bot is online.");
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
  "camel jockey",
  "zipperhead",
  "porch monkey",
  "towelhead",
  "gypsy",

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
  "he she",
  "it pretending to be a woman",
  "it pretending to be a man",

  // SELF HARM
  "kys",
  "kms",
  "khs",
  "kill yourself",
  "killing myself",
  "suicide",
  "self harm",

  // SEXUAL WORDS
  "sex",
  "porn",
  "nudes",
  "nude",
  "boobs",
  "tits",
  "ass",
  "anal",
  "blowjob",
  "bj",
  "cock",
  "dick",
  "penis",
  "vagina",
  "pussy",
  "cum",
  "cumming",
  "horny",
  "masturbate",
  "masturbating",
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
    .setDescription("Displays protected blacklist words")
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

    console.log("Commands registered successfully.");

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
        name: "Advanced Moderation Active",
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

        .setAuthor({
          name: "Advanced Blacklist Protection",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("✦ Moderation Database")

        .setDescription(
          [
            "╔══════════════════════════════╗",
            "        ACTIVE FILTER SYSTEM",
            "╚══════════════════════════════╝",
            "",
            "```ansi",
            rows.join("\n"),
            "```",
            "",
            "✦ Real-time moderation enabled",
            "✦ Automatic deletion active",
            "✦ DM protection warnings enabled",
            "✦ Advanced security monitoring online"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setColor("#c71585")

        .setImage(
          "https://media.tenor.com/4Z9wzP0K4JAAAAAC/anime-pink.gif"
        )

        .setFooter({
          text: "Advanced Protection System • Online"
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

    // ================= IM LEAVING =================
    if (content.includes("im leaving")) {

      await message.delete();

      const leaveEmbed = new EmbedBuilder()

        .setAuthor({
          name: "Conversation Monitor",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("✦ User Leaving Detected")

        .setDescription(
          `${message.author}\n\n\`\`\`ok?\`\`\``
        )

        .setColor("#c71585")

        .setFooter({
          text: "Automatic Response System"
        })

        .setTimestamp();

      await message.channel.send({
        embeds: [leaveEmbed]
      });

      return;
    }

    // ================= MOMO FILTER =================
    if (
      content.includes("momo") ||
      (message.attachments.size > 0 &&
        [...message.attachments.values()].some(attachment =>
          attachment.name?.toLowerCase().includes("momo")
        ))
    ) {

      await message.delete();

      const momoEmbed = new EmbedBuilder()

        .setAuthor({
          name: "Content Protection",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚠ Blocked Content Detected")

        .setDescription(
          [
            "Your message was removed.",
            "",
            "```ansi",
            "The word or GIF 'momo' is restricted.",
            "```"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setColor("#c71585")

        .setFooter({
          text: "Advanced Protection • Content Blocked"
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

        .setAuthor({
          name: "Protected User System",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("✦ Protected User Mentioned")

        .setDescription(
          [
            "Your message was removed.",
            "",
            "```ansi",
            "Fame is busy at this moment sorry.",
            "```"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setColor("#c71585")

        .setFooter({
          text: "Advanced User Protection Enabled"
        })

        .setTimestamp();

      await message.author.send({
        embeds: [protectedEmbed]
      });

      return;
    }

    // ================= BLACKLIST FILTER =================
    const hasAllowedDogGif =
      content.includes(ALLOWED_DOG_GIF);

    const foundWord = blacklist.find(word => {

      // ALLOW SPECIFIC DOG GIF
      if (
        word === "dog" &&
        hasAllowedDogGif
      ) {
        return false;
      }

      // IGNORE ATTACHMENTS FOR DOG
      if (
        word === "dog" &&
        message.attachments.size > 0
      ) {
        return false;
      }

      return content.includes(word.toLowerCase());

    });

    if (foundWord) {

      await message.delete();

      const warningEmbed = new EmbedBuilder()

        .setAuthor({
          name: "Advanced Moderation",
          iconURL: client.user.displayAvatarURL()
        })

        .setTitle("⚠ Moderation Warning")

        .setDescription(
          [
            "Your message has been removed.",
            "",
            "╔════════════════════╗",
            "      BLOCKED WORD",
            "╚════════════════════╝",
            "",
            `\`\`\`${foundWord}\`\`\``,
            "",
            "✦ Please follow the server rules",
            "✦ Repeated violations may result in punishment"
          ].join("\n")
        )

        .setThumbnail(client.user.displayAvatarURL())

        .setColor("#c71585")

        .setImage(
          "https://media.tenor.com/LxggFGxwOjIAAAAC/pink-anime.gif"
        )

        .setFooter({
          text: "Advanced Moderation • Warning Issued"
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
    console.error("Failed to moderate message:", error);
  }

});

// ================= LOGIN =================
client.login(TOKEN);
