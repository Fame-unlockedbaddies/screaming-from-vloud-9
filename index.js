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
    image: "https://cdn.meowia.com/baddies/glitter-bomb.png"
  }
};

// 🖼️ RAP ICON IMAGE (UPLOAD YOUR IMAGE AND PUT LINK HERE)
const RAP_ICON = "PASTE_YOUR_RAP_IMAGE_URL_HERE";

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
    .setDescription("Get the ID of a custom emoji")
    .setDMPermission(true)
    .addStringOption(opt =>
      opt
        .setName("emoji")
        .setDescription("Paste the emoji (e.g. <:rap:123>)")
        .setRequired(true)
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
        json?.props?.pageProps?.props?.items ||
        json?.props?.pageProps?.inventory ||
        [];

      if (!items.length) break;

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

  // ===== EMOJI ID =====
  if (interaction.commandName === "emojiid") {
    const input = interaction.options.getString("emoji");

    const match = input.match(/<?a?:\w+:(\d+)>?/);

    if (!match) {
      return interaction.reply({
        content: "That is not a valid custom emoji.",
        ephemeral: true
      });
    }

    const emojiId = match[1];

    return interaction.reply({
      content: `Emoji ID: ${emojiId}`
    });
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
      .setColor(0x2b2d31)
      .setTitle(weapon.name)
      .setThumbnail(weapon.image)

      // RAP ICON IMAGE
      .setAuthor({
        name: `RAP: ${weapon.rap}`,
        iconURL: RAP_ICON
      })

      .addFields({
        name: "Value",
        value: `${weapon.value}`,
        inline: true
      })

      .setFooter({ text: "Fame • Live Data" })
      .setTimestamp();

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

      let image;

      if (sub === "outfit") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
        );

        image = res.data?.data?.[0]?.imageUrl;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Outfit`)
          .setImage(image)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "mug") {
        const res = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        );

        image = res.data?.data?.[0]?.imageUrl;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${username}'s Mugshot`)
          .setImage(image)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      return interaction.editReply({
        content: "Failed to fetch Roblox data."
      });
    }
  }
});

// START
client.login(TOKEN);
