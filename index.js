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
  .setDescription("Role panels")

  // PART 1 (6 ROLES)
  .addSubcommand(sub =>
    sub.setName("roles1")
      .setDescription("First 6 roles")
      .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
      .addStringOption(o => o.setName("background").setDescription("Image URL").setRequired(true))

      .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
      .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))
      .addStringOption(o => o.setName("name1").setDescription("Name 1"))

      .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
      .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))
      .addStringOption(o => o.setName("name2").setDescription("Name 2"))

      .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
      .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))
      .addStringOption(o => o.setName("name3").setDescription("Name 3"))

      .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
      .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))
      .addStringOption(o => o.setName("name4").setDescription("Name 4"))

      .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
      .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))
      .addStringOption(o => o.setName("name5").setDescription("Name 5"))

      .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
      .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))
      .addStringOption(o => o.setName("name6").setDescription("Name 6"))
  )

  // PART 2 (5 ROLES)
  .addSubcommand(sub =>
    sub.setName("roles2")
      .setDescription("Next 5 roles")
      .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
      .addStringOption(o => o.setName("background").setDescription("Image URL").setRequired(true))

      .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
      .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))
      .addStringOption(o => o.setName("name7").setDescription("Name 7"))

      .addRoleOption(o => o.setName("role8").setDescription("Role 8"))
      .addStringOption(o => o.setName("emoji8").setDescription("Emoji 8"))
      .addStringOption(o => o.setName("name8").setDescription("Name 8"))

      .addRoleOption(o => o.setName("role9").setDescription("Role 9"))
      .addStringOption(o => o.setName("emoji9").setDescription("Emoji 9"))
      .addStringOption(o => o.setName("name9").setDescription("Name 9"))

      .addRoleOption(o => o.setName("role10").setDescription("Role 10"))
      .addStringOption(o => o.setName("emoji10").setDescription("Emoji 10"))
      .addStringOption(o => o.setName("name10").setDescription("Name 10"))

      .addRoleOption(o => o.setName("role11").setDescription("Role 11"))
      .addStringOption(o => o.setName("emoji11").setDescription("Emoji 11"))
      .addStringOption(o => o.setName("name11").setDescription("Name 11"))
  );

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [command.toJSON()] }
  );
})();

client.once("ready", () => console.log("Bot ready"));

// INTERACTIONS
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand() && interaction.commandName === "set") {

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const bg = interaction.options.getString("background");

    const roles = [];

    // collect roles dynamically
    for (let i = 1; i <= 11; i++) {
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

    await interaction.editReply("Panel created");
  }

  // BUTTON HANDLER
  if (interaction.isButton()) {
    const roleId = interaction.customId.split("_")[1];
    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.reply({ content: "Removed", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      return interaction.reply({ content: "Added", ephemeral: true });
    }
  }

});

// START
client.login(TOKEN);
