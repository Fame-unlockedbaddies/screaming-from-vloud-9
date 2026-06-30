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
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const OWNER_ID = '1497846804480524298';
let restoreConfirmationMessageId = null;
const REQUIRED_REACTIONS = 30;
const RESTORE_PASSWORD = "2011";

client.once('ready', async () => {
  console.log(`${client.user.tag} is online - Invite Tracker v3`);
 
  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');
  await client.application.commands.create(data);
});

// ====================== RESTORE COMMAND (OWNER ONLY) ======================
client.on('messageCreate', async (message) => {
  if (message.content.toLowerCase() === '!restore') {
    if (message.author.id !== OWNER_ID) {
      return message.reply({ 
        content: '❌ Only the owner can use this command.', 
        allowedMentions: { repliedUser: false } 
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('⚠️ Restore Confirmation')
      .setDescription('Are you sure you want to restore everyone\'s data?')
      .addFields({ name: 'Required Reactions', value: `${REQUIRED_REACTIONS} reactions with 1️⃣`, inline: true })
      .setFooter({ text: 'React with 1️⃣ to confirm' })
      .setTimestamp();

    const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] });
    restoreConfirmationMessageId = confirmMsg.id;

    await confirmMsg.react('1️⃣');

    const passwordEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔑 Restore Password')
      .setDescription(`The password to start the restore is: ||${RESTORE_PASSWORD}||\n\nAfter reaching ${REQUIRED_REACTIONS} reactions, type \`!restore confirm ${RESTORE_PASSWORD}\` here.`)
      .setFooter({ text: 'Only you can see this password' })
      .setTimestamp();

    await message.author.send({ embeds: [passwordEmbed] }).catch(() => {
      message.reply('Could not send password via DM.');
    });
  }

  if (message.content.toLowerCase().startsWith('!restore confirm ')) {
    if (message.author.id !== OWNER_ID) {
      return message.reply({ 
        content: '❌ Only the owner can use this command.', 
        allowedMentions: { repliedUser: false } 
      });
    }

    const providedPassword = message.content.split(' ').pop().trim();
    if (providedPassword !== RESTORE_PASSWORD) {
      return message.reply('❌ Incorrect password.');
    }

    if (!restoreConfirmationMessageId) {
      return message.reply('No active restore confirmation found.');
    }

    const confirmChannel = message.channel;
    const confirmMsg = await confirmChannel.messages.fetch(restoreConfirmationMessageId).catch(() => null);

    if (!confirmMsg) {
      restoreConfirmationMessageId = null;
      return message.reply('Could not find the confirmation message.');
    }

    const reaction = confirmMsg.reactions.cache.get('1️⃣');
    const reactionCount = reaction ? reaction.count : 0;

    if (reactionCount >= REQUIRED_REACTIONS) {
      const successEmbed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('✅ Data Restore Initiated')
        .setDescription('Restoring everyone\'s data... (Add your restore code here)');
      
      await message.reply({ embeds: [successEmbed] });
      restoreConfirmationMessageId = null;
    } else {
      await message.reply(`⚠️ Not enough reactions. Need **${REQUIRED_REACTIONS}**, got **${reactionCount}**.`);
    }
  }
});

// ====================== INVITE TRACKING ======================
client.on('guildMemberAdd', async (member) => {
  console.log(`[LOG] New member joined: ${member.user.tag} (${member.id})`);
  try {
    const invites = await member.guild.invites.fetch({ cache: false });
    let usedInvite = null;
    for (const invite of invites.values()) {
      if (invite.uses && invite.uses > 0) {
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
          { name: 'Invite', value: `https://discord.gg/${usedInvite.code}`, inline: true },
          { name: 'Total Invites', value: `${usedInvite.uses}`, inline: true }
        )
        .setTimestamp();

      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    }
  } catch (e) {
    console.error('[ERROR] Invite tracking failed:', e);
  }
});

// /inv slash command
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'inv') {
    const invites = await interaction.guild.invites.fetch().catch(() => null);
    if (!invites) return interaction.reply({ content: 'Could not fetch invites.', ephemeral: true });

    const sorted = [...invites.values()]
      .sort((a, b) => (b.uses || 0) - (a.uses || 0))
      .slice(0, 10);

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
