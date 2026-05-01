const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ENV
const TOKEN = process.env.TOKEN;
const ACCESS_CODE = process.env.ACCESS_CODE;
const CLIENT_ID = process.env.CLIENT_ID;

// CONFIG
const ROLE_ID = "1482560426972549232";
const CHANNEL_ID = "1448798824415101030";

// RAP ICON (your image)
const RAP_ICON = "https://bloxtsar.com/_next/image?url=https%3A%2F%2Fcdn.meowia.com%2Fbaddies%2Ftokens.png&w=32&q=75";

// MEMORY
const verifiedUsers = new Set();
let weaponCache = {};

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// SLASH COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName("deletetickets")
    .setDescription("Delete all ticket channels"),

  new SlashCommandBuilder()
    .setName("fame")
    .setDescription("Fame system")
    .addSubcommand(sub =>
      sub
        .setName("weapon")
        .setDescription("Lookup weapon")
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Weapon name")
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
})();

// SCRAPER
async function loadWeapons() {
  try {
    const { data } = await axios.get("https://bloxtsar.com/baddies/items");
    const $ = cheerio.load(data);

    weaponCache = {};

    $(".item, .card, .item-card").each((i, el) => {
      const name = $(el).find("h3, .name, .item-name").text().trim();
      const image = $(el).find("img").attr("src");
      const value = $(el).find(".value, .rap").text().trim();

      if (name) {
        weaponCache[name.toLowerCase()] = {
          name,
          rap: value || "Unknown",
          value: value || "Unknown",
          image: image?.startsWith("http")
            ? image
            : `https://bloxtsar.com${image}`
        };
      }
    });

    console.log("Weapons loaded:", Object.keys(weaponCache).length);

  } catch (err) {
    console.error("Scrape failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadWeapons();

  setInterval(loadWeapons, 10 * 60 * 1000);
});

// MESSAGE COMMANDS
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Verification Code")
      .setStyle(ButtonStyle.Primary);

    return message.reply({
      content: "To restore access, press the button.",
      components: [new ActionRowBuilder().addComponents(button)]
    });
  }
});

// INTERACTIONS
client.on(Events.InteractionCreate, async (interaction) => {

  // SLASH
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "deletetickets") {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return interaction.reply({ content: "No permission." });
      }

      let count = 0;
      for (const [, ch] of interaction.guild.channels.cache) {
        if (ch.name.startsWith("ticket-")) {
          await ch.delete().catch(() => {});
          count++;
        }
      }

      return interaction.reply(`Deleted ${count} ticket channels.`);
    }

    if (interaction.commandName === "fame") {

      const name = interaction.options.getString("name").toLowerCase();
      const weapon = weaponCache[name];

      if (!weapon) {
        return interaction.reply("Weapon not found.");
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("Weapon Lookup")
        .setThumbnail(weapon.image)
        .addFields(
          {
            name: "Weapon",
            value: weapon.name,
            inline: true
          },
          {
            name: `RAP`,
            value: `${weapon.rap}`,
            inline: true
          },
          {
            name: "Value",
            value: weapon.value,
            inline: true
          }
        )
        .setFooter({ text: "Fame System" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }

  // BUTTON
  if (interaction.isButton()) {

    if (interaction.customId === "backup_button") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Verification");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter code")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  }

  // MODAL
  if (interaction.isModalSubmit()) {
    const code = interaction.fields.getTextInputValue("code_input");

    if (code !== ACCESS_CODE) {
      return interaction.reply("Invalid code.");
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(ROLE_ID);

    verifiedUsers.add(interaction.user.id);

    return interaction.reply("Access granted.");
  }
});

// START
client.login(TOKEN);
