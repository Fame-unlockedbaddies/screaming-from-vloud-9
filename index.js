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

const FOUNDER_ROLE_ID = "1482560426972549232";
const ANNOUNCE_CHANNEL_ID = "1448798824415101030";
const WELCOME_CHANNEL_ID = "1487287724674384032";

// 🎯 ROLE SYSTEM
const MESSAGE_ROLE_ID = "1497255894096941076";
const UPGRADE_ROLE_ID = "1448796463491584060";

if (!TOKEN) {
  console.error("Missing TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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

// 🧠 MESSAGE COUNTS (per user)
const messageCounts = new Map();

// ================= READY =================
client.once("ready", async () => {
  console.log("Bot online");

  if (acceptedUsers.size > 0) {
    try {
      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
      const mentions = [...acceptedUsers].map(id => `<@${id}>`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Membership Reset Required")
        .setDescription("Run /fame upcoming to regain access.")
        .addFields({ name: "Affected Users", value: mentions || "None" })
        .setColor(0xff0000);

      await channel.send({ embeds: [embed] });
    } catch {}

    acceptedUsers.clear();
    saveUsers([]);
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("fame")
      .setDescription("Fame system")
      .addSubcommand(sub =>
        sub.setName("upcoming").setDescription("Accept TOS")
      ),

    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Send to exclusive users")
      .addStringOption(o =>
        o.setName("message").setDescription("Message").setRequired(true)
      )
      .addAttachmentOption(o =>
        o.setName("image").setDescription("Optional image")
      ),

    new SlashCommandBuilder()
      .setName("channelidfinder")
      .setDescription("Get a channel ID")
      .addChannelOption(o =>
        o.setName("channel").setDescription("Select channel").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("rolecolour")
      .setDescription("Get a role's hex colour")
      .addRoleOption(option =>
        option.setName("role")
          .setDescription("Select a role")
          .setRequired(true)
      ),
  ];

  await client.application.commands.set(commands);
});

// ================= MESSAGE SYSTEM =================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const userId = message.author.id;
  const member = message.member;

  // Count messages per user
  const count = (messageCounts.get(userId) || 0) + 1;
  messageCounts.set(userId, count);

  // Remove role if user has upgrade role
  if (member.roles.cache.has(UPGRADE_ROLE_ID)) {
    if (member.roles.cache.has(MESSAGE_ROLE_ID)) {
      await member.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
    }
    return;
  }

  // 🎉 Give role after 10+ messages (for EVERY user)
  if (count >= 10 && !member.roles.cache.has(MESSAGE_ROLE_ID)) {

    await member.roles.add(MESSAGE_ROLE_ID).catch(() => {});

    try {
      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
      const role = message.guild.roles.cache.get(MESSAGE_ROLE_ID);

      const embed = new EmbedBuilder()
        .setDescription(
          `${message.author} you have received this role <@&${MESSAGE_ROLE_ID}> 🎉\n` +
          `you have received the Fame Newgen role`
        )
        .setColor(0xff69b4)
        .setThumbnail(role?.iconURL());

      await channel.send({ embeds: [embed] });

    } catch (err) {
      console.log(err);
    }
  }
});

// ================= AUTO REMOVE ON UPGRADE =================
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (
    !oldMember.roles.cache.has(UPGRADE_ROLE_ID) &&
    newMember.roles.cache.has(UPGRADE_ROLE_ID)
  ) {
    if (newMember.roles.cache.has(MESSAGE_ROLE_ID)) {
      await newMember.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
    }
  }
});

// ================= WELCOME =================
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle("🌸 Welcome to Fame")
      .setDescription(`Welcome ${member} 💖`)
      .setColor(0xff69b4)
      .setImage("https://media.discordapp.net/attachments/1448798824415101030/1496995710988451850/EB9CBC93-0BDF-4C15-832A-545BC2F41C2D.gif");

    await channel.send({
      content: `${member}`,
      embeds: [embed],
    });

  } catch (err) {
    console.log(err);
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "channelidfinder") {
      if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
        return interaction.reply({ content: "❌ Founder only", ephemeral: true });
      }

      const channel = interaction.options.getChannel("channel");

      return interaction.reply({
        content: `📌 Channel: ${channel}\n🆔 ID: ${channel.id}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "rolecolour") {
      const role = interaction.options.getRole("role");
      const colorInt = role.color;

      if (!colorInt || colorInt === 0) {
        return interaction.reply({
          content: "⚠️ This role has no colour.",
          ephemeral: true,
        });
      }

      const hex = `#${colorInt.toString(16).padStart(6, "0")}`;

      const r = (colorInt >> 16) & 255;
      const g = (colorInt >> 8) & 255;
      const b = colorInt & 255;

      const embed = new EmbedBuilder()
        .setTitle("🎨 Role Colour")
        .addFields(
          { name: "Role", value: `${role}`, inline: true },
          { name: "Hex", value: `\`${hex}\``, inline: true },
          { name: "RGB", value: `(${r}, ${g}, ${b})`, inline: true }
        )
        .setColor(colorInt);

      return interaction.reply({ embeds: [embed] });
    }

    if (
      interaction.commandName === "fame" &&
      interaction.options.getSubcommand() === "upcoming"
    ) {
      const userId = interaction.user.id;

      const embed = new EmbedBuilder()
        .setTitle("🌸 Fame Access")
        .setDescription("Accept TOS")
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

    if (interaction.commandName === "send") {
      if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
        return interaction.reply({ content: "❌ Founder only", ephemeral: true });
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
            .setColor(0xff69b4);

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

  if (interaction.isButton()) {
    const ownerId = interaction.customId.split("_")[1];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Run command yourself",
        ephemeral: true,
      });
    }

    if (interaction.customId.startsWith("accept")) {
      acceptedUsers.add(interaction.user.id);
      saveUsers([...acceptedUsers]);

      await interaction.message.delete().catch(() => {});

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${interaction.user} is now an exclusive member.`)
            .setColor(0x00ff88),
        ],
      });
    }

    if (interaction.customId.startsWith("decline")) {
      await interaction.message.delete().catch(() => {});
    }
  }
});

// ================= SERVER =================
http.createServer((req, res) => {
  res.end("Bot running");
}).listen(PORT);

client.login(TOKEN);
