const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
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
const NUKE_PASSWORD = 'meka123';

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
});

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userId = parts[2];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });
    }

    // ====================== MOVE BOOSTER ======================
    if (action === 'movebootser') {
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

      if (interaction.isModalSubmit() && interaction.customId.startsWith('movebootser_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guild = interaction.guild;
        const boosterRoleId = '1429174538754592778';
        const targetRoleId = '1513349804141445120';
        const boosterRole = guild.roles.cache.get(boosterRoleId);
        const targetRole = guild.roles.cache.get(targetRoleId);

        if (!boosterRole) return interaction.reply({ content: '❌ Booster role not found.', ephemeral: true });
        if (!targetRole) return interaction.reply({ content: '❌ Target role not found.', ephemeral: true });

        try {
          await boosterRole.setPosition(targetRole.position - 1);
          await interaction.reply({
            content: `✅ Successfully moved **${boosterRole.name}** underneath the target role!`,
            ephemeral: true
          });
        } catch (err) {
          console.error(err);
          await interaction.reply({
            content: '❌ Failed to move role.\nMake sure the bot has **Manage Roles** permission and is higher than both roles.',
            ephemeral: true
          });
        }
      }
    }

    // ====================== NUKE BACK ======================
    else if (action === 'nukeback') {
      if (interaction.isButton() && interaction.customId.startsWith('nukeback_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`nukeback_modal_${userId}`)
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
        if (password !== NUKE_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guild = interaction.guild;
        await interaction.reply({ content: '☢️ Starting nuke...', ephemeral: true });

        try {
          // Delete all channels and categories
          const channels = guild.channels.cache;
          for (const [id, channel] of channels) {
            if (channel.id !== interaction.channelId) { // Don't delete the current channel yet
              await channel.delete().catch(() => {});
            }
          }

          // Create new chat channel
          const newChannel = await guild.channels.create({
            name: 'chat',
            type: 0, // GUILD_TEXT
            reason: 'Nuke recovery channel'
          });

          await newChannel.send('# Server has been nuked and reset.');

          // Delete the command channel last
          const cmdChannel = guild.channels.cache.get(interaction.channelId);
          if (cmdChannel) await cmdChannel.delete().catch(() => {});

        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '❌ Error during nuke process.', ephemeral: true }).catch(() => {});
        }
      }
    }

    // ====================== ATE (KICK BOTS) ======================
    else if (action === 'ate') {
      if (interaction.isButton() && interaction.customId.startsWith('ate_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`ate_modal_${userId}`)
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
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        const guild = interaction.guild;
        await interaction.reply({ content: '👢 Kicking all bots...', ephemeral: true });

        let kicked = 0;
        const members = await guild.members.fetch();

        for (const [id, member] of members) {
          if (member.user.bot && member.id !== client.user.id) {
            try {
              await member.kick('Nuke command executed');
              kicked++;
            } catch (e) {
              console.error(`Failed to kick bot ${member.user.tag}`);
            }
          }
        }

        await interaction.followUp({
          content: `✅ Kicked **${kicked}** bots from the server.`,
          ephemeral: true
        }).catch(() => {});
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
