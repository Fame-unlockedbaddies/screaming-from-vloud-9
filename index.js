
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

// SLASH
const commands = [
  new SlashCommandBuilder()
    .setName("fame")
    .setDescription("Fame trading system")
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


// 🔥 REAL SCRAPER (NO FALLBACK)
async function loadWeapons() {
  try {
    weaponCache = {};
    let page = 1;

    while (true) {
      console.log("Fetching page", page);

      const res = await axios.get(
        `https://bloxtsar.com/baddies/items?page=${page}`
      );

      const html = res.data;

      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/
      );

      if (!match) {
        console.log("No NEXT_DATA found");
        break;
      }

      const json = JSON.parse(match[1]);

      // 🔍 DEBUG ON FIRST PAGE
      if (page === 1) {
        console.log("DEBUG STRUCTURE:");
        console.log(Object.keys(json.props.pageProps));
      }

      const items =
        json?.props?.pageProps?.items ||
        json?.props?.pageProps?.data ||
        json?.props?.pageProps?.props?.items ||
        json?.props?.pageProps?.inventory ||
        [];

      if (!items || items.length === 0) {
        console.log("No items on page", page);
        break;
      }

      for (const item of items) {
        if (!item?.name) continue;

        weaponCache[item.name.toLowerCase()] = {
          name: item.name,
          rap: item.rap?.toString() || "Unknown",
          value: item.value?.toString() || "Unknown",
          image: item.image || item.icon || ""
        };
      }

      page++;
    }

    console.log("Weapons loaded:", Object.keys(weaponCache).length);

  } catch (err) {
    console.error("SCRAPER ERROR:", err);
  }
}


// READY
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadWeapons();
});


// SEARCH (clean but strict)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "fame") {
    const input = interaction.options.getString("name").toLowerCase();

    let weapon = weaponCache[input];

    if (!weapon) {
      weapon = Object.values(weaponCache).find(w =>
        w.name.toLowerCase().includes(input)
      );
    }

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
      .setFooter({ text: "Fame • Live Data" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
