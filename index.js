const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder
} = require('discord.js');

const express = require('express');
require('dotenv').config();

const LOG_CHANNEL_ID = '1520178827186274425';

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
  console.log(`${client.user.tag} is online - Invite Tracker v2`);

  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');

  await client.application.commands.create(data);
});

// ====================== SIMPLE & STRONG TRACKING ======================
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;

  console.log(`New member joined: ${member.user.tag}`);

  try {
    const invites = await member.guild.invites.fetch({ cache: false });
    let usedInvite = null;

    for (const invite of invites.values()) {
      if (invite.uses > 0) {
        usedInvite = invite;
        break;
      }
    }

    if (usedInvite) {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#00ff88')
          .setTitle('📨 New Member Joined')
          .setDescription(`**${member.user.tag}** joined the server!`)
          .addFields(
            { name: 'Inviter', value: usedInvite.inviter?.tag || 'Unknown', inline: true },
            { name: 'Invite Link', value: `https://discord.gg/${usedInvite.code}`, inline: true },
            { name: 'Total Invites', value: `${usedInvite.uses}`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        console.log(`✅ Embed sent to log channel for ${member.user.tag}`);
      }
    }
  } catch (e) {
    console.error('Error in invite tracking:', e);
  }
});

// /inv command
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites) return interaction.reply({ content: 'Could not fetch invites.', ephemeral: true });

    const sorted = [...invites.values()].sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle(`Invite Leaderboard - ${interaction.guild.name}`);

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
