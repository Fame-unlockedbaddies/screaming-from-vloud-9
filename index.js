console.log("BOOTING...");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Events,
  PermissionsBitField
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1428878035926388809";

const AUTO_ROLE = "1448796463491584060";
const WELCOME_CHANNEL = "1487287724674384032";

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server ready");
});

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= COMMAND =================
const commands = [

  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create a role button panel")

    .addStringOption(o => o.setName("title").setDescription("Panel title").setRequired(true))

    // 7 roles
    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Label 1"))
    .addStringOption(o => o.setName("emoji1").setDescription("Emoji 1"))

    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Label 2"))
    .addStringOption(o => o.setName("emoji2").setDescription("Emoji 2"))

    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Label 3"))
    .addStringOption(o => o.setName("emoji3").setDescription("Emoji 3"))

    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addStringOption(o => o.setName("name4").setDescription("Label 4"))
    .addStringOption(o => o.setName("emoji4").setDescription("Emoji 4"))

    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
    .addStringOption(o => o.setName("name5").setDescription("Label 5"))
    .addStringOption(o => o.setName("emoji5").setDescription("Emoji 5"))

    .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
    .addStringOption(o => o.setName("name6").setDescription("Label 6"))
    .addStringOption(o => o.setName("emoji6").setDescription("Emoji 6"))

    .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
    .addStringOption(o => o.setName("name7").setDescription("Label 7"))
    .addStringOption(o => o.setName("emoji7").setDescription("Emoji 7"))

].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered");
  } catch (err) {
    console.error(err);
  }
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // ===== BUTTON HANDLER =====
  if (i.isButton()) {

    let roleId;

    // ✅ SUPPORT OLD + NEW PANELS
    if (i.customId.startsWith("role_")) {
      roleId = i.customId.split("_")[1];
    } else {
      roleId = i.customId;
    }

    const role = i.guild.roles.cache.get(roleId);

    if (!role) {
      return i.reply({
        content: "❌ Role not found (it may have been deleted)",
        ephemeral: true
      });
    }

    // 🔒 PERMISSION CHECKS
    if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return i.reply({
        content: "❌ I don't have **Manage Roles** permission",
        ephemeral: true
      });
    }

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.reply({
        content: `❌ I can't manage ${role} (move my role higher)`,
        ephemeral: true
      });
    }

    try {
      if (i.member.roles.cache.has(roleId)) {

        await i.member.roles.remove(roleId);

        await i.reply({
          content: `➖ Removed ${role} (${role.name})`,
          ephemeral: true
        });

      } else {

        await i.member.roles.add(roleId);

        await i.reply({
          content: `✅ Added ${role} (${role.name})`,
          ephemeral: true
        });
      }

    } catch (err) {
      console.error(err);
      await i.reply({
        content: "❌ Error assigning role (check console)",
        ephemeral: true
      });
    }

    return;
  }

  // ===== SLASH COMMANDS =====
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(i.options.getString("title"));

    const rows = [];
    let row = new ActionRowBuilder();

    for (let x = 1; x <= 7; x++) {
      const role = i.options.getRole(`role${x}`);
      const name = i.options.getString(`name${x}`);
      const emoji = i.options.getString(`emoji${x}`);

      if (!role || !name) continue;

      const btn = new ButtonBuilder()
        .setCustomId(role.id) // NEW format
        .setLabel(name)
        .setStyle(ButtonStyle.Secondary);

      if (emoji) btn.setEmoji(emoji);

      row.addComponents(btn);

      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
    }

    if (row.components.length > 0) rows.push(row);

    await i.channel.send({ embeds: [embed], components: rows });
    await i.reply({ content: "✅ Panel created", ephemeral: true });
  }

});

// ================= AUTO ROLE =================
client.on("guildMemberAdd", async member => {
  await member.roles.add(AUTO_ROLE).catch(() => {});

  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(`Welcome <@${member.id}>`)
    .setThumbnail(member.user.displayAvatarURL());

  ch.send({ embeds: [embed] });
});

// ================= LOGIN =================
client.login(TOKEN);
