process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log("Web server running"));

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let weaponCache = {};

// 🔥 CUSTOM GLITTER BOMB
const customWeapons = {
  "glitter bomb": {
    name: "Glitter Bomb",
    image: "https://cdn.meowia.com/baddies/glitter-bomb.png",
    rarity: "Legend",
    value: "200,000",
    rap: "145,000",
    demand: "Amazing",
    trend: "Raising"
  }
};

// ---------------- COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("fame")
    .setDescription("Fame trading system")
    .setDMPermission(true)
    .addSubcommand(sub =>
      sub
        .setName("weapon")
        .setDescription("Lookup weapon")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Weapon name").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Roblox tools")
    .setDMPermission(true)

    .addSubcommand(sub =>
      sub
        .setName("outfit")
        .setDescription("Get player's full avatar")
        .addStringOption(opt =>
          opt.setName("username")
            .setDescription("Roblox username")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("mug")
        .setDescription("Get player's headshot")
        .addStringOption(opt =>
          opt.setName("username")
            .setDescription("Roblox username")
            .setRequired(true)
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
})();

// ---------------- READY ----------------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===== FAME =====
  if (interaction.commandName === "fame") {
    await interaction.deferReply();

    const input = interaction.options.getString("name").toLowerCase();

    let weapon = customWeapons[input];

    if (!weapon) {
      return interaction.editReply({ content: "Weapon not found." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image)
      .setDescription(
        `__${weapon.rarity}__\n\n` +
        `**<:rap:1500289824333234236> RAP:** ${weapon.rap}\n` +
        `**Value:** ${weapon.value}\n` +
        `**Demand:** ${weapon.demand}\n` +
        `**Trend:** ${weapon.trend}\n\n` +
        `────────────────────────────\n` +
        `*these values are from fame!*`
      );

    return interaction.editReply({ embeds: [embed] });
  }

  // ===== ROBLOX =====
  if (interaction.commandName === "roblox") {
    const sub = interaction.options.getSubcommand();
    const username = interaction.options.getString("username");

    await interaction.deferReply();

    try {
      const userRes = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        {
          usernames: [username],
          excludeBannedUsers: true
        }
      );

      if (!userRes.data.data?.length) {
        return interaction.editReply({ content: "Roblox user not found." });
      }

      const userId = userRes.data.data[0].id;

      // ===== OUTFIT =====
      if (sub === "outfit") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
        );

        const image = res.data?.data?.[0]?.imageUrl;

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2b2d31)
              .setTitle(`${username}'s Outfit`)
              .setURL(`https://www.roblox.com/users/${userId}/profile`)
              .setImage(image)
          ]
        });
      }

      // ===== MUGSHOT =====
      if (sub === "mug") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        );

        const image = res.data?.data?.[0]?.imageUrl;

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2b2d31)
              .setTitle(`${username}'s Mugshot`)
              .setURL(`https://www.roblox.com/users/${userId}/profile`)
              .setImage(image)
          ]
        });
      }

    } catch (err) {
      console.error(err.message);
      return interaction.editReply({
        content: "Failed to fetch Roblox data."
      });
    }
  }
});

client.login(TOKEN);
