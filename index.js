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
const MAIN_PASSWORD = 'Meka2017charlie';

// EXPRESS + CONFIG
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
    GatewayIntentBits.MessageContent
  ]
});

// Ready
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);
});

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // !movebootser
  if (content === '!movebootser') {
    const embed = new EmbedBuilder()
      .setColor('#ff00ff')
      .setTitle('🔄 !MOVEBOOT SER')
      .setDescription('This will move the Booster role (ID: 1429174538754592778) down to the desired position.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`movebootser_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Primary)
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

    // Button → Modal
    if (interaction.isButton() && interaction.customId.startsWith('movebootser_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`movebootser_modal_${userId}`)
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

    // Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('movebootser_modal_')) {
      const password = interaction.fields.getTextInputValue('password');

      if (password !== MAIN_PASSWORD) {
        return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
      }

      const guild = interaction.guild;
      const boosterRoleId = '1429174538754592778';   // ← Updated ID

      const boosterRole = guild.roles.cache.get(boosterRoleId);
      if (!boosterRole) {
        return interaction.reply({ content: '❌ Booster role with that ID was not found.', ephemeral: true });
      }

      try {
        // Move the booster role just above the target position (you can adjust if needed)
        await boosterRole.setPosition(boosterRole.position - 5); // Moves it down 5 positions (adjust number as needed)
        
        await interaction.reply({ 
          content: `✅ Successfully moved **${boosterRole.name}** down!`, 
          ephemeral: true 
        });
      } catch (err) {
        console.error(err);
        await interaction.reply({ 
          content: '❌ Failed to move the role.\nMake sure the bot has **Manage Roles** permission and is placed higher than the Booster role.', 
          ephemeral: true 
        });
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
