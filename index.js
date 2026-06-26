const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder
} = require('discord.js');

const express = require('express');
require('dotenv').config();

const LOG_CHANNEL_ID = '1520178827186274425'; // Your channel

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

  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');

  await client.application.commands.create(data);
});

// ====================== INVITE CREATED ======================
client.on('inviteCreate', async invite => {
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#00ffff')
    .setTitle('🔗 New Invite Link Created')
    .addFields(
      { name: 'Created By', value: invite.inviter?.tag || 'Unknown', inline: true },
      { name: 'Invite Code', value: `https://discord.gg/${invite.code}`, inline: true },
      { name: 'Max Uses', value: invite.maxUses ? invite.maxUses.toString() : '∞', inline: true }
    )
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

// ====================== MEMBER JOIN VIA INVITE ======================
client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  try {
    const invites = await member.guild.invites.fetch();
    let usedInvite = null;

    for (const invite of invites.values()) {
      if (invite.uses > (invite.inviter?.lastInviteUses || 0)) {
        usedInvite = invite;
        break;
      }
    }

    if (usedInvite && usedInvite.inviter) {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('📨 New Member Joined via Invite')
        .setDescription(`**${member.user.tag}** joined the server!`)
        .addFields(
          { name: 'Inviter', value: usedInvite.inviter.tag, inline: true },
          { name: 'Invite Code', value: `https://discord.gg/${usedInvite.code}`, inline: true },
          { name: 'Total Invites', value: `${usedInvite.uses}`, inline: true }
        )
        .setTimestamp();

      logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (e) {
    console.error('Invite tracking error:', e);
  }
});

// ====================== /inv COMMAND ======================
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites || invites.size === 0) {
      return interaction.reply({ content: 'No active invites found.', ephemeral: true });
    }

    const sorted = [...invites.values()].sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 12);

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle(`📊 Invite Leaderboard - ${interaction.guild.name}`);

    sorted.forEach(inv => {
      embed.addFields({
        name: inv.inviter?.tag || 'Unknown',
        value: `**Invites:** ${inv.uses || 0}`,
        inline: true
      });
    });

    await interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
