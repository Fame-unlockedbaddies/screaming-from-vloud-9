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

// ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// BOT
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
          opt.setName("name")
            .setDescription("Weapon name")
            .setRequired(true)
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

// ---------------- SCRAPER ----------------
async function loadWeapons() {
  try {
    weaponCache = {};
    let page = 1;

    while (true) {
      const res = await axios.get(
        `https://bloxtsar.com/baddies/items?page=${page}`
      );

      const html = res.data;

      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/
      );

      if (!match) break;

      const json = JSON.parse(match[1]);

      const items =
        json?.props?.pageProps?.items ||
        json?.props?.pageProps?.data ||
        json?.props?.pageProps?.inventory ||
        [];

      if (!items.length) break;

      for (const item of items) {
        if (!item?.name) continue;

        weaponCache[item.name.toLowerCase()] = {
          name: item.name,
          rap: item.rap?.toLocaleString?.() || "Unknown",
          value: item.value?.toLocaleString?.() || "Unknown",
          image: item.image || item.icon || ""
        };
      }

      page++;
    }

  } catch (err) {
    console.error(err.message);
  }
}

// ---------------- READY ----------------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadWeapons();
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===== FAME =====
  if (interaction.commandName === "fame") {
    await interaction.deferReply();

    const input = interaction.options.getString("name").toLowerCase();

    let weapon = weaponCache[input];

    if (!weapon) {
      weapon = Object.values(weaponCache).find(w =>
        w.name.toLowerCase().includes(input)
      );
    }

    if (customWeapons[input]) {
      weapon = customWeapons[input];
    }

    if (!weapon) {
      return interaction.editReply({ content: "Weapon not found." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image)

      .setDescription(
        `__${weapon.rarity || "Legend"}__\n\n` +
        `**<:rap:1500289824333234236> RAP:** ${weapon.rap}\n` +
        `**Value:** ${weapon.value}\n` +
        `**Demand:** ${weapon.demand || "Unknown"}\n` +
        `**Trend:** ${weapon.trend || "Unknown"}\n\n` +
        "\n\n" +
        "────────────────────────────\n" +
        "*these values are from fame!*"
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

      if (sub === "outfit") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png`
        );

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Outfit`)
          .setImage(res.data.data[0].imageUrl);

        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "mug") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`
        );

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Mugshot`)
          .setImage(res.data.data[0].imageUrl);

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err.message);
      return interaction.editReply({
        content: "Failed to fetch Roblox data."
      });
    }
  }
});

// START
client.login(TOKEN);
