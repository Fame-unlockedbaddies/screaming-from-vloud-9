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
  AuditLogEvent
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

// ================= BLACKLIST =================
const blacklist = [
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

  "kys",
  "kms",
  "khs",
  "kill yourself",
  "killing myself",

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

  "fuck",
  "fucking",
  "fack",
  "bitch",
  "shit",
  "motherfucker",
  "bastard",
  "cunt",

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
    .setDescription("Displays blacklist system")
].map(command => command.toJSON());

// ================= REGISTER COMMANDS =================
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

    console.log("Commands registered.");

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

    client.user.setPresence({
      activities: [
        {
          name:
            "Advanced Protection Active",
          type: 3
        }
      ],
      status: "dnd"
    });

  }
);

// ================= SLASH COMMAND =================
client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) {
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

// ================= MESSAGE CACHE =================
const messageCache = new Map();

// ================= MESSAGE CREATE =================
client.on(
  Events.MessageCreate,
  async message => {

    if (message.author.bot) return;

    messageCache.set(message.id, {
      content: message.content
    });

    const content =
      (message.content || "").toLowerCase();

    try {

      // ================= GIF CHECK =================
      const isGif =
        content.includes("tenor.com") ||
        content.includes(".gif") ||
        content.includes("giphy.com");

      // ================= INVITE FILTER =================
      const inviteRegex =
        /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;

      if (inviteRegex.test(content)) {

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
                "Advanced Invite Protection"
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

      // ================= IGNORE GIFS =================
      if (isGif) return;

      // ================= BLACKLIST =================
      const compactContent =
        content.replace(/\s+/g, "");

      const foundWord =
        blacklist.find(word => {

          const compactWord =
            word
              .toLowerCase()
              .replace(/\s+/g, "");

          if (
            content.includes(
              word.toLowerCase()
            )
          ) {
            return true;
          }

          if (
            compactContent.includes(
              compactWord
            )
          ) {
            return true;
          }

          return false;

        });

      // ================= DELETE MESSAGE =================
      if (foundWord) {

        await message.delete();

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
                  "Removed",
                inline: true
              },
              {
                name: "Protection",
                value:
                  "Enabled",
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
      console.error(
        "Moderation error:",
        error
      );
    }

  }
);

// ================= MESSAGE EDIT LOG =================
client.on(
  Events.MessageUpdate,
  async (oldMessage, newMessage) => {

    try {

      if (newMessage.author?.bot) return;

      const oldContent =
        oldMessage.content || "Unknown";

      const newContent =
        newMessage.content || "Unknown";

      if (oldContent === newContent) {
        return;
      }

      const editEmbed =
        new EmbedBuilder()

          .setColor("#ff1493")

          .setTitle(
            "Message Edited"
          )

          .addFields(
            {
              name: "User",
              value:
                `${newMessage.author.tag}`,
              inline: true
            },
            {
              name: "Channel",
              value:
                `${newMessage.channel}`,
              inline: true
            },
            {
              name: "Old Message",
              value:
                oldContent.slice(
                  0,
                  1000
                )
            },
            {
              name: "New Message",
              value:
                newContent.slice(
                  0,
                  1000
                )
            }
          )

          .setFooter({
            text:
              "Message Logs"
          })

          .setTimestamp();

      await sendLog(
        newMessage.guild,
        editEmbed
      );

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= TIMEOUT LOG =================
client.on(
  Events.GuildMemberUpdate,
  async (oldMember, newMember) => {

    try {

      const oldTimeout =
        oldMember.communicationDisabledUntilTimestamp;

      const newTimeout =
        newMember.communicationDisabledUntilTimestamp;

      if (
        !oldTimeout &&
        newTimeout
      ) {

        const logs =
          await newMember.guild.fetchAuditLogs({
            limit: 1,
            type:
              AuditLogEvent.MemberUpdate
          });

        const entry =
          logs.entries.first();

        const embed =
          new EmbedBuilder()

            .setColor("#ff1493")

            .setTitle(
              "User Timed Out"
            )

            .addFields(
              {
                name: "User",
                value:
                  `${newMember.user.tag}`,
                inline: true
              },
              {
                name: "Moderator",
                value:
                  `${entry?.executor?.tag || "Unknown"}`,
                inline: true
              }
            )

            .setFooter({
              text:
                "Moderation Logs"
            })

            .setTimestamp();

        await sendLog(
          newMember.guild,
          embed
        );

      }

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= BAN LOG =================
client.on(
  Events.GuildBanAdd,
  async ban => {

    try {

      const logs =
        await ban.guild.fetchAuditLogs({
          limit: 1,
          type:
            AuditLogEvent.MemberBanAdd
        });

      const entry =
        logs.entries.first();

      const embed =
        new EmbedBuilder()

          .setColor("#ff1493")

          .setTitle(
            "User Banned"
          )

          .addFields(
            {
              name: "User",
              value:
                `${ban.user.tag}`,
              inline: true
            },
            {
              name: "Moderator",
              value:
                `${entry?.executor?.tag || "Unknown"}`,
              inline: true
            },
            {
              name: "Reason",
              value:
                entry?.reason ||
                "No reason"
            }
          )

          .setFooter({
            text:
              "Moderation Logs"
          })

          .setTimestamp();

      await sendLog(
        ban.guild,
        embed
      );

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= UNBAN LOG =================
client.on(
  Events.GuildBanRemove,
  async ban => {

    try {

      const logs =
        await ban.guild.fetchAuditLogs({
          limit: 1,
          type:
            AuditLogEvent.MemberBanRemove
        });

      const entry =
        logs.entries.first();

      const embed =
        new EmbedBuilder()

          .setColor("#ff1493")

          .setTitle(
            "User Unbanned"
          )

          .addFields(
            {
              name: "User",
              value:
                `${ban.user.tag}`,
              inline: true
            },
            {
              name: "Moderator",
              value:
                `${entry?.executor?.tag || "Unknown"}`,
              inline: true
            }
          )

          .setFooter({
            text:
              "Moderation Logs"
          })

          .setTimestamp();

      await sendLog(
        ban.guild,
        embed
      );

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= KICK LOG =================
client.on(
  Events.GuildMemberRemove,
  async member => {

    try {

      const logs =
        await member.guild.fetchAuditLogs({
          limit: 1,
          type:
            AuditLogEvent.MemberKick
        });

      const entry =
        logs.entries.first();

      if (!entry) return;

      if (
        entry.target.id !==
        member.id
      ) {
        return;
      }

      const embed =
        new EmbedBuilder()

          .setColor("#ff1493")

          .setTitle(
            "User Kicked"
          )

          .addFields(
            {
              name: "User",
              value:
                `${member.user.tag}`,
              inline: true
            },
            {
              name: "Moderator",
              value:
                `${entry.executor.tag}`,
              inline: true
            },
            {
              name: "Reason",
              value:
                entry.reason ||
                "No reason"
            }
          )

          .setFooter({
            text:
              "Moderation Logs"
          })

          .setTimestamp();

      await sendLog(
        member.guild,
        embed
      );

    } catch (error) {
      console.error(error);
    }

  }
);

// ================= LOGIN =================
client.login(TOKEN);
