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

// 🔥 CUSTOM WEAPONS (your override system)
const customWeapons = {
  "glitter bomb": {
    name: "Glitter Bomb",
    rap: "145,000",
    value: "200,000",
    image: "YOUR_IMAGE_URL_HERE" // <-- put your uploaded image link
  }
};

// ---------------- COMMANDS ----------------
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
    ),

  new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Roblox tools")

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
      console.log("Fetching page", page);

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
        json?.props?.pageProps?.props?.items ||
        json?.props?.pageProps?.inventory ||
        [];

      if (!items || items.length === 0) break;

      for (const item of items) {
        if (!item?.name) continue;

        weaponCache[item.name.toLowerCase()] = {
          name: item.name,
          rap: item.rap?.toLocaleString?.() || item.rap?.toString() || "Unknown",
          value: item.value?.toLocaleString?.() || item.value?.toString() || "Unknown",
          image: item.image || item.icon || ""
        };
      }

      page++;
    }

    console.log("Weapons loaded:", Object.keys(weaponCache).length);

  } catch (err) {
    console.error("SCRAPER ERROR:", err.message);
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
    const input = interaction.options.getString("name").toLowerCase();

    let weapon = weaponCache[input];

    if (!weapon) {
      weapon = Object.values(weaponCache).find(w =>
        w.name.toLowerCase().includes(input)
      );
    }

    // 🔥 CHECK CUSTOM WEAPONS FIRST
    if (customWeapons[input]) {
      weapon = customWeapons[input];
    }

    if (!weapon) {
      return interaction.reply({ content: "Weapon not found." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image) // ✅ medium/small image
      .addFields(
        { name: "RAP", value: `${weapon.rap}`, inline: true },
        { name: "Value", value: `${weapon.value}`, inline: true }
      )
      .setFooter({ text: "Fame • Live Data" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== ROBLOX =====
  if (interaction.commandName === "roblox") {
    const sub = interaction.options.getSubcommand();
    const username = interaction.options.getString("username");

    try {
      const userRes = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        {
          usernames: [username],
          excludeBannedUsers: true
        }
      );

      if (!userRes.data.data?.length) {
        return interaction.reply({ content: "Roblox user not found." });
      }

      const user = userRes.data.data[0];
      const userId = user.id;

      let image;

      // ===== OUTFIT =====
      if (sub === "outfit") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
        );

        image = res.data?.data?.[0]?.imageUrl;

        if (!image) {
          return interaction.reply({
            content: "Could not load avatar outfit."
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Outfit`)
          .setImage(image)
          .setFooter({ text: "Fame • Roblox Outfit" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ===== MUG =====
      if (sub === "mug") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        );

        image = res.data?.data?.[0]?.imageUrl;

        if (!image) {
          return interaction.reply({
            content: "Could not load avatar mugshot."
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Mugshot`)
          .setImage(image)
          .setFooter({ text: "Fame • Roblox Mug" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

    } catch (err) {
      console.error("ROBLOX ERROR:", err.message);

      return interaction.reply({
        content: "Failed to fetch Roblox data."
      });
    }
  }
});

// START
client.login(TOKEN);
