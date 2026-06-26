const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder
} = require('discord.js');

const express = require('express');
require('dotenv').config();

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1520186678805925918/gFidvdESdvS9w6sQU8VVuPavN3PVW-VjaDmf1GFUEHV6OV0owVcJV7iHPmvKCBOqNthh';

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
  console.log(`${client.user.tag} is online - Webhook Invite Tracker Active`);

  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');

  await client.application.commands.create(data);
});

// ====================== SEND TO WEBHOOK ======================
async function sendToWebhook(embed) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    console.log('✅ Embed sent to webhook');
  } catch (e) {
    console.error('Webhook error:', e);
  }
}

// ====================== INVITE CREATED ======================
client.on('inviteCreate', async (invite) => {
  const embed = new EmbedBuilder()
    .setColor('#00ffff')
    .setTitle('🔗 New Invite Link Created')
    .addFields(
      { name: 'Created By', value: invite.inviter?.tag || 'Unknown', inline: true },
      { name: 'Invite Link', value: `https://discord.gg/${invite.code}`, inline: true },
      { name: 'Max Uses', value: invite.maxUses ? invite.maxUses.toString() : '∞', inline: true }
    )
    .setTimestamp();

  await sendToWebhook(embed);
});

// ====================== MEMBER JOIN VIA INVITE ======================
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;

  try {
    const invites = await member.guild.invites.fetch();
    let usedInvite = null;

    for (const invite of invites.values()) {
      if (invite.uses > 0) {
        usedInvite = invite;
        break;
      }
    }

    if (usedInvite) {
      const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('📨 New Member Joined via Invite')
        .setDescription(`**${member.user.tag}** joined the server!`)
        .addFields(
          { name: 'Inviter', value: usedInvite.inviter?.tag || 'Unknown', inline: true },
          { name: 'Invite Link', value: `https://discord.gg/${usedInvite.code}`, inline: true },
          { name: 'Total Invites', value: `${usedInvite.uses}`, inline: true }
        )
        .setTimestamp();

      await sendToWebhook(embed);
    }
  } catch (e) {
    console.error('Invite tracking error:', e);
  }
});

// /inv command
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites) return interaction.reply({ content: 'Could not fetch invites.', ephemeral: true });

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
