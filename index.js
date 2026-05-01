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
  SlashCommandBuilder
} = require("discord.js");

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Web server
app.get("/", (req, res) => {
  res.send("Bot is running.");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ENV
const TOKEN = process.env.TOKEN;
const ACCESS_CODE = process.env.ACCESS_CODE;
const CLIENT_ID = process.env.CLIENT_ID;

// CONFIG
const ROLE_ID = "1482560426972549232";
const CHANNEL_ID = "1448798824415101030";

// Temporary verified users
const verifiedUsers = new Set();

// 🤖 Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔧 Register GLOBAL slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("deletetickets")
    .setDescription("Delete all ticket channels"),

  new SlashCommandBuilder()
    .setName("fame")
    .setDescription("Fame system commands")
    .addSubcommand(sub =>
      sub
        .setName("weapon")
        .setDescription("Check weapon RAP")
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
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("Global slash commands registered.");
  } catch (error) {
    console.error(error);
  }
})();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 💬 Message commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  // !backup
  if (message.content === "!backup") {
    const button = new ButtonBuilder()
      .setCustomId("backup_button")
      .setLabel("Enter Verification Code")
      .setStyle(ButtonStyle.Primary);

    return message.reply({
      content: "To restore your access, select the option below and enter your verification code.",
      components: [new ActionRowBuilder().addComponents(button)]
    });
  }

  // !backupremove
  if (message.content === "!backupremove") {
    const button = new ButtonBuilder()
      .setCustomId("remove_button")
      .setLabel("Remove Access")
      .setStyle(ButtonStyle.Danger);

    return message.reply({
      content: "To remove your access, select the option below and confirm using your code.",
      components: [new ActionRowBuilder().addComponents(button)]
    });
  }

  // !selectrole
  if (message.content === "!selectrole") {

    if (!verifiedUsers.has(message.author.id)) {
      return message.reply("Access denied. You must complete verification using !backup before selecting a role.");
    }

    const roles = message.guild.roles.cache
      .filter(role =>
        role.editable &&
        !role.managed &&
        role.name !== "@everyone"
      )
      .first(5);

    if (!roles.length) {
      return message.reply("No assignable roles are currently available.");
    }

    const buttons = roles.map(role =>
      new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(role.name)
        .setStyle(ButtonStyle.Secondary)
    );

    return message.reply({
      content: "Please choose one of the available roles below.",
      components: [new ActionRowBuilder().addComponents(buttons)]
    });
  }
});

// ⚡ Interactions
client.on(Events.InteractionCreate, async (interaction) => {

  // Slash commands
  if (interaction.isChatInputCommand()) {

    // /deletetickets
    if (interaction.commandName === "deletetickets") {

      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true
        });
      }

      let deletedCount = 0;

      for (const [, channel] of interaction.guild.channels.cache) {
        if (channel.name.startsWith("ticket-")) {
          try {
            await channel.delete();
            deletedCount++;
          } catch (err) {
            console.error(err);
          }
        }
      }

      return interaction.reply({
        content: `Operation complete. ${deletedCount} ticket channels were removed.`,
        ephemeral: false
      });
    }

    // /fame weapon
    if (interaction.commandName === "fame") {

      if (interaction.options.getSubcommand() === "weapon") {

        return interaction.reply({
          content:
`╔══════════════════════════════╗
   FAME SYSTEM INITIALIZING
╚══════════════════════════════╝

This bot is currently in development and is not yet ready.

Fame is actively working on this system.
Please wait while updates are being completed.

Status: Initializing modules...`,
          ephemeral: true
        });
      }
    }
  }

  // Buttons
  if (interaction.isButton()) {

    if (interaction.customId === "backup_button") {
      const modal = new ModalBuilder()
        .setCustomId("backup_modal")
        .setTitle("Verification Required");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter your access code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "remove_button") {
      const modal = new ModalBuilder()
        .setCustomId("remove_modal")
        .setTitle("Confirm Removal");

      const input = new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel("Enter your access code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId.startsWith("role_")) {

      if (!verifiedUsers.has(interaction.user.id)) {
        return interaction.reply({
          content: "Access denied. You are not verified.",
          ephemeral: true
        });
      }

      const roleId = interaction.customId.split("_")[1];

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(roleId);

        return interaction.reply({
          content: "Your selected role has been successfully assigned.",
          ephemeral: true
        });

      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "The role could not be assigned. Please contact an administrator.",
          ephemeral: true
        });
      }
    }
  }

  // Modal submit
  if (interaction.isModalSubmit()) {

    const code = interaction.fields.getTextInputValue("code_input");

    if (code !== ACCESS_CODE) {
      return interaction.reply({
        content: "The access code you entered is invalid. Please try again.",
        ephemeral: true
      });
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (interaction.customId === "backup_modal") {
        await member.roles.add(ROLE_ID);
        verifiedUsers.add(interaction.user.id);

        return interaction.reply({
          content: "Welcome back. Your access has been successfully restored. You may now proceed to select your role using !selectrole.",
          ephemeral: true
        });
      }

      if (interaction.customId === "remove_modal") {
        await member.roles.remove(ROLE_ID);
        verifiedUsers.delete(interaction.user.id);

        await interaction.reply({
          content: "Your elevated access has been removed.",
          ephemeral: true
        });

        await interaction.channel.send(
          `<@${interaction.user.id}> the role previously assigned to this user has been revoked following the execution of the command !backupremove.`
        );
      }

    } catch (err) {
      console.error("ROLE ERROR:", err);

      return interaction.reply({
        content: "The requested action could not be completed due to a permissions issue.",
        ephemeral: true
      });
    }
  }
});

// Start bot
client.login(TOKEN);
