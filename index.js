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

const inviteCache = new Map(); // code => uses

client.once('ready', async () => {
  console.log(`${client.user.tag} is online - Invite Tracker Active`);

  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');

  await client.application.commands.create(data);
});

// ====================== PERIODIC CHECK + EVENT TRACKING ======================
async function checkInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

    for (const invite of invites.values()) {
      const oldUses = inviteCache.get(invite.code) || 0;

      if (invite.uses > oldUses) {
        inviteCache.set(invite.code, invite.uses);

        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('📨 New Member Joined via Invite')
            .setDescription(`**Someone** joined using an invite!`)
            .addFields(
              { name: 'Inviter', value: invite.inviter?.tag || 'Unknown', inline: true },
              { name: 'Invite Code', value: `https://discord.gg/${invite.code}`, inline: true },
              { name: 'Total Invites', value: `${invite.uses}`, inline: true }
            )
            .setTimestamp();

          logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  } catch (e) {}
}

// Run check every 5 seconds
setInterval(() => {
  client.guilds.cache.forEach(guild => checkInvites(guild));
}, 5000);

// Also listen to events
client.on('inviteCreate', async (invite) => {
  console.log(`New invite created: ${invite.code}`);
  inviteCache.set(invite.code, invite.uses || 0);

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('🔗 New Invite Link Created')
      .addFields(
        { name: 'Created By', value: invite.inviter?.tag || 'Unknown', inline: true },
        { name: 'Invite', value: `https://discord.gg/${invite.code}`, inline: true }
      )
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  }
});

// /inv command
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites) return interaction.reply({ content: 'Could not fetch invites.', ephemeral: true });

    const sorted = [...invites.values()].sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 15);

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
