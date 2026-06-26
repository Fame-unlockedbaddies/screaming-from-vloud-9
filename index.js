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
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');

const express = require('express');
require('dotenv').config();

// PASSWORDS
const MAIN_PASSWORD = 'Meka2017charlie';
const NUKE_PASSWORD = 'meka123';

const userSessions = new Map();
const inviteTracker = new Map(); // code => uses

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites
  ]
});

client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  // Register /inv slash command
  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show current invite leaderboard');

  await client.application.commands.create(data);
});

// ====================== INVITE TRACKER (Real-time) ======================
client.on('inviteCreate', invite => {
  inviteTracker.set(invite.code, invite.uses || 0);
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  try {
    const invites = await member.guild.invites.fetch();
    let usedInvite = null;

    for (const invite of invites.values()) {
      if (invite.uses > (inviteTracker.get(invite.code) || 0)) {
        usedInvite = invite;
        inviteTracker.set(invite.code, invite.uses);
        break;
      }
    }

    if (usedInvite && usedInvite.inviter) {
      const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('📨 New Member Joined via Invite')
        .setDescription(`**${member.user.tag}** joined the server!`)
        .addFields(
          { name: 'Inviter', value: `${usedInvite.inviter.tag} (${usedInvite.inviter.id})`, inline: true },
          { name: 'Invite Code', value: usedInvite.code, inline: true },
          { name: 'Total Invites', value: `${usedInvite.uses}`, inline: true }
        )
        .setTimestamp();

      // Send to a channel (you can change 'general' to any channel name)
      const logChannel = member.guild.channels.cache.find(c => 
        c.name.includes('general') || c.name.includes('chat') || c.name.includes('welcome')
      ) || member.guild.systemChannel;

      if (logChannel) {
        logChannel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error('Invite tracking error:', e);
  }
});

// ====================== /inv SLASH COMMAND ======================
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites || invites.size === 0) {
      return interaction.reply({ content: 'No invites found in this server.', ephemeral: true });
    }

    const sorted = [...invites.values()].sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 15);

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle(`📊 Invite Leaderboard - ${interaction.guild.name}`)
      .setDescription('Top inviters:');

    sorted.forEach(inv => {
      embed.addFields({
        name: inv.inviter?.tag || 'Unknown',
        value: `**Invites:** ${inv.uses || 0}\n**Code:** ${inv.code}`,
        inline: true
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  // Keep your !check / Nuke logic here if you still want it
  // (I removed the full nuke for cleanliness - let me know if you want it back)
});

client.login(TOKEN);
