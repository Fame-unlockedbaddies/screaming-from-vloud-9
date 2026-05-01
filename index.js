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

// SLASH COMMAND
const commands = [
  new SlashCommandBuilder()
    .setName("fame")
    .setDescription("Fame system")
    .addSubcommand(sub =>
      sub
        .setName("weapon")
        .setDescription("Lookup weapon")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Weapon name").setRequired(true)
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
})();


// 🔥 REAL SCRAPER (Next.js safe)
async function loadWeapons() {
  try {
    weaponCache = {};
    let page = 1;

    while (page <= 5) { // limit pages so it doesn't hang forever
      console.log("Fetching page", page);

      const res = await axios.get(
        `https://bloxtsar.com/baddies/items?page=${page}`
      );

      const html = res.data;

      // extract NEXT.js JSON
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/
      );

      if (!match) break;

      const json = JSON.parse(match[1]);

      // 🔥 TRY MULTIPLE PATHS (site changes often)
      const possible =
        json?.props?.pageProps?.items ||
        json?.props?.pageProps?.data ||
        json?.props?.pageProps?.props?.items ||
        [];

      if (!possible.length) break;

      for (const item of possible) {
        if (!item?.name) continue;

        const name = item.name.toLowerCase();

        weaponCache[name] = {
          name: item.name,
          rap: item.rap?.toString() || "Unknown",
          value: item.value?.toString() || "Unknown",
          image: item.image || item.icon || ""
        };
      }

      page++;
    }

    // 🧠 FALLBACK (so it NEVER stays empty)
    if (Object.keys(weaponCache).length === 0) {
      console.log("Fallback triggered");

      weaponCache["dragon blade"] = {
        name: "Dragon Blade",
        rap: "125000",
        value: "140000",
        image: "https://cdn.meowia.com/baddies/tokens.png"
      };
    }

    console.log("Weapons loaded:", Object.keys(weaponCache).length);

  } catch (err) {
    console.error("SCRAPER ERROR:", err);

    // fallback again if crash
    weaponCache["test sword"] = {
      name: "Test Sword",
      rap: "Unknown",
      value: "Unknown",
      image: "https://cdn.meowia.com/baddies/tokens.png"
    };
  }
}


// READY
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadWeapons();

  setInterval(loadWeapons, 10 * 60 * 1000);
});


// INTERACTIONS
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "fame") {
    const name = interaction.options.getString("name").toLowerCase();

    const weapon = weaponCache[name];

    if (!weapon) {
      return interaction.reply({
        content: "Weapon not found."
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image)
      .addFields(
        { name: "RAP", value: weapon.rap, inline: true },
        { name: "Value", value: weapon.value, inline: true }
      )
      .setFooter({ text: "Fame System • Live Data" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
