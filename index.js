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

// WEB
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
  .setDescription("Role panel")
  .addSubcommand(sub =>
    sub
      .setName("role-reactions")
      .setDescription("Create role panel")

      .addStringOption(o =>
        o.setName("title").setDescription("Panel title").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("background").setDescription("Image URL").setRequired(true)
      )

      // 🔥 7 ROLE LIMIT (SAFE)
      .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
      .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))
      .addStringOption(o => o.setName("name1").setDescription("Button name 1"))

      .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
      .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
      .addStringOption(o => o.setName("name2").setDescription("Button name 2"))

      .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
      .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
      .addStringOption(o => o.setName("name3").setDescription("Button name 3"))

      .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
      .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))
      .addStringOption(o => o.setName("name4").setDescription("Button name 4"))

      .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
      .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))
      .addStringOption(o => o.setName("name5").setDescription("Button name 5"))

      .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
      .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))
      .addStringOption(o => o.setName("name6").setDescription("Button name 6"))

      .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
      .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))
      .addStringOption(o => o.setName("name7").setDescription("Button name 7"))
  );

// REGISTER
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
    interaction.commandName === "set"
  ) {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    for (let i = 1; i <= 7; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const emoji = interaction.options.getString(`emoji${i}`);
      const name = interaction.options.getString(`name${i}`);

      if (role && emoji && name) {
        roles.push({ role, emoji, name });
      }
    }

    if (!roles.length) {
      return interaction.editReply("Add at least one role.");
    }

    const rows = [];
    let row = new ActionRowBuilder();

    roles.forEach(r => {
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

    await interaction.editReply("Panel created.");
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
