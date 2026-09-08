require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("copyrole")
    .setDescription("Copy role information")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub
        .setName("hex")
        .setDescription("Copy the hex color(s) of a role")
        .addRoleOption(option =>
          option.setName("role").setDescription("The role to copy colors from").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("emoji")
        .setDescription("Copy the emoji of a role")
        .addRoleOption(option =>
          option.setName("role").setDescription("The role to copy emoji from").setRequired(true)
        )
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Commands deployed successfully!");
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
})();
