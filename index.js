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

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ================= COMMAND =================
const commands = [
  new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Create a single-choice role panel")
    .addStringOption(o => o.setName("title").setRequired(true).setDescription("Title"))
    .addStringOption(o => o.setName("banner").setDescription("Banner URL"))

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

// ================= ROLE PANEL STORAGE =================
const panelRoles = new Map(); // messageId -> [roleIds]

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // ===== BUTTON CLICK =====
  if (i.isButton()) {

    await i.deferReply({ ephemeral: true }); // 🔥 fixes interaction failed

    const roleId = i.customId;
    const role = i.guild.roles.cache.get(roleId);

    if (!role) {
      return i.editReply("❌ Role not found");
    }

    if (!i.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return i.editReply("❌ Missing Manage Roles");
    }

    if (role.position >= i.guild.members.me.roles.highest.position) {
      return i.editReply("❌ Role too high");
    }

    const rolesInPanel = panelRoles.get(i.message.id) || [];

    try {
      // remove all panel roles first
      for (const r of rolesInPanel) {
        if (i.member.roles.cache.has(r)) {
          await i.member.roles.remove(r).catch(()=>{});
        }
      }

      // add selected role
      await i.member.roles.add(roleId);

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

    const banner = i.options.getString("banner");
    if (banner) embed.setImage(banner);

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

    const msg = await i.channel.send({ embeds: [embed], components: [row] });

    // store roles for this panel
    panelRoles.set(msg.id, roleIds);

    await i.reply({ content: "✅ Panel created", ephemeral: true });
  }

});

// ================= LOGIN =================
client.login(TOKEN);
