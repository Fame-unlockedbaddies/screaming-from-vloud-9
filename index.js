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

// MEMORY
let weaponCache = {};

// 🔥 CUSTOM WEAPON (Glitter Bomb EXACT VALUES)
const customWeapons = {
  "glitter bomb": {
    name: "Glitter Bomb",
    image: "https://cdn.meowia.com/baddies/glitter-bomb.png",

    rarity: "Legend",
    value: "650,000",
    token: "345,000",
    rap: "5,881",
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

  if (interaction.commandName === "fame") {
    await interaction.deferReply();

    const input = interaction.options.getString("name").toLowerCase();

    let weapon = weaponCache[input];

    if (!weapon) {
      weapon = Object.values(weaponCache).find(w =>
        w.name.toLowerCase().includes(input)
      );
    }

    // 🔥 CUSTOM OVERRIDE
    if (customWeapons[input]) {
      weapon = customWeapons[input];
    }

    if (!weapon) {
      return interaction.editReply({ content: "Weapon not found." });
    }

    // 🔥 EMBED STYLE YOU REQUESTED
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image)

      .setDescription(
        `__${weapon.rarity || "Legend"}__\n\n` +
        `**Value:** ${weapon.value}\n` +
        `**Token Value:** ${weapon.token || "Unknown"}\n` +
        `**RAP:** ${weapon.rap}\n` +
        `**Demand:** ${weapon.demand || "Unknown"}\n` +
        `**Trend:** ${weapon.trend || "Unknown"}`
      )

      .setFooter({ text: "Fame • Live Data" });

    return interaction.editReply({ embeds: [embed] });
  }
});

// START
client.login(TOKEN);
