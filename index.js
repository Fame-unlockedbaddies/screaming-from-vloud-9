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
    .setDescription("Single choice role panel")
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

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async i => {

  // ===== BUTTON CLICK =====
  if (i.isButton()) {

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);

    // get ALL buttons from ALL rows
    const allButtons = [];
    for (const row of i.message.components) {
      for (const btn of row.components) {
        allButtons.push(btn);
      }
    }

    try {
      // 🔥 REMOVE ALL PANEL ROLES
      for (const btn of allButtons) {
        const rId = btn.customId;

        if (member.roles.cache.has(rId)) {
          await member.roles.remove(rId).catch(()=>{});
        }
      }

      // 🔥 ADD NEW ROLE
      const role = await i.guild.roles.fetch(i.customId).catch(() => null);

      if (!role) return i.editReply("❌ Role not found");

      if (role.position >= i.guild.members.me.roles.highest.position) {
        return i.editReply("❌ Role too high");
      }

      await member.roles.add(role.id);

      return i.editReply(`✅ You selected ${role}`);

    } catch (err) {
      console.error(err);
      return i.editReply("❌ Failed (check permissions)");
    }
  }

  // ===== COMMAND =====
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

      if (!role || !name) continue;

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(role.id)
          .setLabel(name)
          .setStyle(ButtonStyle.Secondary)
      );

      // max 5 buttons per row
      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
    }

    if (row.components.length > 0) rows.push(row);

    await i.channel.send({
      embeds: [embed],
      components: rows
    });

    await i.reply({ content: "✅ Panel created", ephemeral: true });
  }

});

// ================= LOGIN =================
client.login(TOKEN);
