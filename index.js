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
  EmbedBuilder,
  ActivityType
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const LOG_CHANNEL_ID = "1503214617294278676";
const PROTECTED_USER_ID = "1497846804480524298";

// ================= KEEP ALIVE =================
const app = express();

app.get("/", (req, res) => {
  res.send("Advanced protection bot online.");
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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages
  ]
});

// ================= STATUS =================
function setBotStatus() {

  client.user.setPresence({
    status: "dnd",
    activities: [
      {
        name: "discord.gg/famee",
        type: ActivityType.Watching
      }
    ]
  });

}

// ================= BLACKLIST =================
const blacklist = [

  // RACIAL
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

  // LGBT
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

  // SEXUAL
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

// ================= LOG FUNCTION =================
async function sendLog(guild, embed) {

  try {

    const channel =
      guild.channels.cache.get(LOG_CHANNEL_ID);

    if (!channel) return;

    await channel.send({
      embeds: [embed]
    });

  } catch (error) {
    console.error("Log error:", error);
  }

}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder()
    .setName("whatperioddoes")
    .setDescription(
      "Displays blacklist system"
    )

].map(command => command.toJSON());

// ================= REGISTER =================
const rest = new REST({
  version: "10"
}).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      "Commands registered."
    );

  } catch (error) {
    console.error(error);
  }

})();

// ================= READY =================
client.once(
  Events.ClientReady,
  bot => {

    console.log(
      `Logged in as ${bot.user.tag}`
    );

    setBotStatus();

    // KEEP STATUS FOREVER
    setInterval(() => {
      setBotStatus();
    }, 15000);

  }
);

// ================= SLASH COMMAND =================
client.on(
  Events.InteractionCreate,
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    try {

      if (
        interaction.commandName ===
        "whatperioddoes"
      ) {

        const rows = [];
        const wordsPerRow = 3;

        for (
          let i = 0;
          i < embedWords.length;
          i += wordsPerRow
        ) {

          rows.push(
            embedWords
              .slice(i, i + wordsPerRow)
              .join(" | ")
          );

        }

        const embed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setAuthor({
              name:
                "Advanced Moderation Database",
              iconURL:
                client.user.displayAvatarURL()
            })

            .setTitle(
              "Protection System"
            )

            .setDescription(
              [
                "Blacklist monitoring enabled.",
                "",
                "```",
                rows.join("\n"),
                "```"
              ].join("\n")
            )

            .addFields(
              {
                name: "Status",
                value:
                  "```Online```",
                inline: true
              },
              {
                name: "Auto Delete",
                value:
                  "```Enabled```",
                inline: true
              },
              {
                name: "DM Warnings",
                value:
                  "```Enabled```",
                inline: true
              }
            )

            .setFooter({
              text:
                "Advanced Protection"
            })

            .setTimestamp();

        await interaction.reply({
          embeds: [embed]
        });

      }

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= MESSAGE CREATE =================
client.on(
  Events.MessageCreate,
  async message => {

    try {

      if (message.author.bot) {
        return;
      }

      const content =
        (
          message.content || ""
        ).toLowerCase();

      // ================= IGNORE GIFS =================
      const isGif =
        content.includes(
          "tenor.com"
        ) ||
        content.includes(".gif") ||
        content.includes(
          "giphy.com"
        );

      if (isGif) {
        return;
      }

      // ================= INVITE FILTER =================
      const inviteRegex =
        /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;

      if (
        inviteRegex.test(content)
      ) {

        await message.delete();

        const embed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setTitle(
              "Discord Invite Blocked"
            )

            .setDescription(
              "Discord invites are not allowed."
            )

            .setFooter({
              text:
                "Invite Protection"
            })

            .setTimestamp();

        await message.author.send({
          embeds: [embed]
        }).catch(() => {});

        await sendLog(
          message.guild,
          embed
        );

        return;

      }

      // ================= PROTECTED USER =================
      if (
        message.mentions.users.has(
          PROTECTED_USER_ID
        )
      ) {

        await message.delete();

        const embed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setTitle(
              "Mention Blocked"
            )

            .setDescription(
              "Fame is busy at this moment sorry."
            )

            .setFooter({
              text:
                "Protected User System"
            })

            .setTimestamp();

        await message.author.send({
          embeds: [embed]
        }).catch(() => {});

        return;

      }

      // ================= SMART BLACKLIST =================
      const foundWord =
        blacklist.find(word => {

          const escaped =
            word.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          // FULL WORD MATCH
          const regex =
            new RegExp(
              `(^|\\b)${escaped}(\\b|$)`,
              "i"
            );

          // SPACE BYPASS MATCH
          const spacedRegex =
            new RegExp(
              word
                .split("")
                .map(letter =>
                  letter.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )
                )
                .join("\\s*"),
              "i"
            );

          // NORMAL WORD
          if (
            regex.test(content)
          ) {
            return true;
          }

          // SPACE BYPASS
          if (
            spacedRegex.test(content)
          ) {
            return true;
          }

          return false;

        });

      // ================= DELETE MESSAGE =================
      if (foundWord) {

        await message.delete();

        // ================= DM USER =================
        const warningEmbed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setTitle(
              "Message Removed"
            )

            .setDescription(
              [
                "Your message contained a restricted word.",
                "",
                `Blocked Word: ${foundWord}`
              ].join("\n")
            )

            .addFields(
              {
                name: "Status",
                value:
                  "```Removed```",
                inline: true
              },
              {
                name: "Protection",
                value:
                  "```Enabled```",
                inline: true
              }
            )

            .setFooter({
              text:
                "Advanced Protection"
            })

            .setTimestamp();

        await message.author.send({
          embeds: [warningEmbed]
        }).catch(() => {});

        // ================= LOG =================
        const logEmbed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setTitle(
              "Blacklist Detection"
            )

            .addFields(
              {
                name: "User",
                value:
                  `${message.author.tag}`,
                inline: true
              },
              {
                name: "Word",
                value:
                  `${foundWord}`,
                inline: true
              },
              {
                name: "Channel",
                value:
                  `${message.channel}`,
                inline: true
              }
            )

            .setFooter({
              text:
                "Moderation Logs"
            })

            .setTimestamp();

        await sendLog(
          message.guild,
          logEmbed
        );

      }

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= LOGIN =================
client.login(TOKEN);
