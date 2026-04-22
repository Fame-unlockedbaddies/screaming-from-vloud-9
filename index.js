const http = require("http");
const fs = require("fs");
const {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

const FOUNDER_ID = "1482560426972549232";
const ANNOUNCE_CHANNEL_ID = "1448798824415101030";

if (!TOKEN) {
  console.error("Missing TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ===== STORAGE =====
const FILE = "./users.json";

function loadUsers() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE));
}

function saveUsers(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

let acceptedUsers = new Set(loadUsers());


// ================= READY =================
client.once("ready", async () => {
  console.log("Bot online");

  // ===== RESET ANNOUNCEMENT =====
  if (acceptedUsers.size > 0) {
    try {
      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

      const mentions = [...acceptedUsers].map(id => `<@${id}>`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Membership Reset Required")
        .setDescription(
          "**Your Fame membership has ended.**\n\n" +
          "The bot was **updated or restarted**.\n\n" +
          "To continue receiving:\n" +
          "• Leaks\n" +
          "• Upcoming updates\n" +
          "• Items & systems\n\n" +
          "**You must accept the TOS again.**\n\n" +
          "👉 Run `/fame upcoming` to become an exclusive member again."
        )
        .addFields({
          name: "Affected Users",
          value: mentions || "None",
        })
        .setColor(0xff0000)
        .setFooter({ text: "Fame System Reset Notice" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

    } catch (err) {
      console.log("Failed to send reset message", err);
    }

    // CLEAR USERS AFTER ANNOUNCEMENT
    acceptedUsers.clear();
    saveUsers([]);
  }

  // ===== COMMANDS =====
  const commands = [
    new SlashCommandBuilder()
      .setName("fame")
      .setDescription("Fame system")
      .addSubcommand(sub =>
        sub.setName("upcoming")
          .setDescription("Accept TOS")
      ),

    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Send to exclusive users")
      .addStringOption(o =>
        o.setName("message")
          .setDescription("Message")
          .setRequired(true)
      )
      .addAttachmentOption(o =>
        o.setName("image")
          .setDescription("Optional image")
      )
  ];

  await client.application.commands.set(commands);
});


// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    // ===== /fame upcoming =====
    if (
      interaction.commandName === "fame" &&
      interaction.options.getSubcommand() === "upcoming"
    ) {

      const userId = interaction.user.id;

      const embed = new EmbedBuilder()
        .setTitle("🌸 Fame Access")
        .setDescription("Accept TOS to become an exclusive member.")
        .setColor(0xff69b4);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_${userId}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`decline_${userId}`)
          .setLabel("Decline")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // ===== /send =====
    if (interaction.commandName === "send") {

      if (interaction.user.id !== FOUNDER_ID) {
        return interaction.reply({
          content: "❌ Only the founder can use this.",
          ephemeral: true,
        });
      }

      const text = interaction.options.getString("message");
      const image = interaction.options.getAttachment("image");

      let sent = 0;

      for (const userId of acceptedUsers) {
        try {
          const user = await client.users.fetch(userId);

          const embed = new EmbedBuilder()
            .setTitle("📢 Fame Update")
            .setDescription(text)
            .setColor(0xff69b4)
            .setTimestamp();

          if (image) embed.setImage(image.url);

          await user.send({ embeds: [embed] });
          sent++;
        } catch {}
      }

      return interaction.reply({
        content: `✅ Sent to ${sent} users.`,
        ephemeral: true,
      });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    const ownerId = interaction.customId.split("_")[1];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Run the command yourself.",
        ephemeral: true,
      });
    }

    // ACCEPT
    if (interaction.customId.startsWith("accept")) {

      acceptedUsers.add(interaction.user.id);
      saveUsers([...acceptedUsers]);

      await interaction.message.delete().catch(() => {});

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Accepted")
            .setDescription(`${interaction.user} is now an exclusive member.`)
            .setColor(0x00ff88)
        ]
      });

      try {
        await interaction.user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("✨ Welcome to Fame")
              .setDescription(
                "You will receive:\n" +
                "• Votes\n• Leaks\n• Upcoming systems\n\n" +
                "If the bot updates or restarts, you must run `/fame upcoming` again."
              )
              .setColor(0xff69b4)
          ]
        });
      } catch {}
    }

    // DECLINE
    if (interaction.customId.startsWith("decline")) {
      await interaction.message.delete().catch(() => {});
    }
  }
});


client.login(TOKEN);


// ================= SERVER =================
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);
