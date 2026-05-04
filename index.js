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

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

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
    .setDescription("Create single-select role panel")
    .addStringOption(o => o.setName("title").setRequired(true).setDescription("Title"))

    .addRoleOption(o => o.setName("role1").setDescription("Role 1"))
    .addStringOption(o => o.setName("name1").setDescription("Label 1"))

    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addStringOption(o => o.setName("name2").setDescription("Label 2"))

    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addStringOption(o => o.setName("name3").setDescription("Label 3"))

    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addStringOption(o => o.setName("name4").setDescription("Label 4"))

    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))
    .addStringOption(o => o.setName("name5").setDescription("Label 5"))

    .addRoleOption(o => o.setName("role6").setDescription("Role 6"))
    .addStringOption(o => o.setName("name6").setDescription("Label 6"))

    .addRoleOption(o => o.setName("role7").setDescription("Role 7"))
    .addStringOption(o => o.setName("name7").setDescription("Label 7"))
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands registered");
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= PANEL STORAGE =================
const panelRoles = new Map();

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // ===== BUTTON =====
  if (i.isButton()) {

    await i.deferReply({ ephemeral: true });

    // support old + new IDs
    let roleId = i.customId.startsWith("role_")
      ? i.customId.split("_")[1]
      : i.customId;

    let role = i.guild.roles.cache.get(roleId);

    // 🔥 FIX: fetch if not cached
    if (!role) {
      try {
        role = await i.guild.roles.fetch(roleId);
      } catch {}
    }

    if (!role) {
      return i.editReply("❌ Role not found (maybe deleted)");
    }

    // fetch member (fix cache issue)
    const member = await i.guild.members.fetch(i.user.id);

    if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return i.editReply("❌ Missing Manage Roles permission");
    }

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.editReply(`❌ Cannot manage ${role}`);
    }

    const rolesInPanel = panelRoles.get(i.message.id) || [];

    try {
      // remove old roles
      for (const r of rolesInPanel) {
        if (member.roles.cache.has(r)) {
          await member.roles.remove(r).catch(()=>{});
        }
      }

      // add new role
      await member.roles.add(roleId);

      i.editReply(`✅ You now have ${role}`);

    } catch (err) {
      console.error(err);
      i.editReply("❌ Failed (check permissions)");
    }

    return;
  }

  // ===== COMMAND =====
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "rolepanel") {

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(i.options.getString("title"));

    const row = new ActionRowBuilder();
    const roleIds = [];

    for (let x = 1; x <= 7; x++) {
      const role = i.options.getRole(`role${x}`);
      const name = i.options.getString(`name${x}`);

      if (!role || !name) continue;

      roleIds.push(role.id);

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(role.id)
          .setLabel(name)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const msg = await i.channel.send({
      embeds: [embed],
      components: [row]
    });

    panelRoles.set(msg.id, roleIds);

    await i.reply({ content: "✅ Panel created", ephemeral: true });
  }

});

// ================= LOGIN =================
client.login(TOKEN);
