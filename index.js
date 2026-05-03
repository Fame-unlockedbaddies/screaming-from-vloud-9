process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require("discord.js");

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

// WEB (render keep alive)
const app = express();
app.get("/", (req, res) => res.send("Running"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// COMMAND
const command = new SlashCommandBuilder()
  .setName("set")
  .setDescription("Setup role panel")
  .addSubcommand(sub => {
    sub
      .setName("role-reactions")
      .setDescription("Create role panel")
      .addStringOption(o =>
        o.setName("title").setDescription("Panel title").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("background").setDescription("Image URL").setRequired(true)
      );

    // 🔥 25 ROLE SLOTS
    for (let i = 1; i <= 25; i++) {
      sub.addRoleOption(o =>
        o.setName(`role${i}`).setDescription(`Role ${i}`)
      );
      sub.addStringOption(o =>
        o.setName(`emoji${i}`).setDescription(`Emoji ${i}`)
      );
      sub.addStringOption(o =>
        o.setName(`name${i}`).setDescription(`Button name ${i}`)
      );
    }

    return sub;
  });

// REGISTER (NO DUPLICATES)
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  console.log("Registering command...");
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [command.toJSON()] }
  );
  console.log("Done.");
})();

client.once("ready", () => console.log("Bot ready"));

// INTERACTIONS
client.on(Events.InteractionCreate, async interaction => {

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "set" &&
    interaction.options.getSubcommand() === "role-reactions"
  ) {

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    // COLLECT ROLES
    for (let i = 1; i <= 25; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const emoji = interaction.options.getString(`emoji${i}`);
      const name = interaction.options.getString(`name${i}`);

      if (role && emoji && name) {
        roles.push({ role, emoji, name });
      }
    }

    if (roles.length === 0) {
      return interaction.editReply("You must add at least 1 role.");
    }

    // BUILD ROWS (5 PER ROW)
    const rows = [];
    let row = new ActionRowBuilder();

    roles.forEach((r) => {
      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${r.role.id}`)
          .setLabel(r.name)
          .setEmoji(r.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    if (row.components.length > 0) rows.push(row);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(title)
      .setImage(bg);

    await interaction.channel.send({
      embeds: [embed],
      components: rows
    });

    await interaction.editReply("Role panel created.");
  }

  // BUTTON HANDLER
  if (interaction.isButton()) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Role removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Role added", ephemeral: true });
    }
  }

});

// START
client.login(TOKEN);
