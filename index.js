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

// 🔥 CUSTOM WEAPONS
const customWeapons = {
  "glitter bomb": {
    name: "Glitter Bomb",
    rap: "145,000",
    value: "200,000",
    image: "https://cdn.meowia.com/baddies/glitter-bomb.png",
    rarity: "Legend"
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
    .setName("emojiid")
    .setDescription("Get emoji ID")
    .setDMPermission(true)
    .addStringOption(opt =>
      opt.setName("emoji").setDescription("Paste emoji").setRequired(true)
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
          image: item.image || item.icon || "",
          rarity: item.rarity || ""
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

  // ===== EMOJI ID =====
  if (interaction.commandName === "emojiid") {
    const input = interaction.options.getString("emoji");
    const match = input.match(/<?a?:\w+:(\d+)>?/);

    if (!match) {
      return interaction.reply({ content: "Invalid emoji", ephemeral: true });
    }

    return interaction.reply({ content: `Emoji ID: ${match[1]}` });
  }

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
      .setColor(0xff4df0) // 🔥 Bloxiana-style color

      // 🔥 TITLE
      .setTitle(weapon.name)

      // 🔥 LEGEND UNDERLINED
      .setDescription(`__${weapon.rarity || "Legend"}__`)

      // 🔥 IMAGE (RIGHT SIDE)
      .setThumbnail(weapon.image)

      .addFields(
        {
          name: "<:rap:1500289824333234236> RAP",
          value: `${weapon.rap}`,
          inline: true
        },
        {
          name: "Value",
          value: `${weapon.value}`,
          inline: true
        }
      )

      .setFooter({ text: "Fame • Live Data" });

    return interaction.editReply({ embeds: [embed] });
  }
});

// START
client.login(TOKEN);
