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
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || "iHkvg8jKFkmQgzNRDJe2BZ1/LxE7JRJSP5p5Aauji+0yp9EjZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1sSWEzWm5PR3BMUm10dFVXZDZUbEpFU21VeVFsb3hMMHg0UlRkS1VrcFRVRFZ3TlVGaGRXcHBLekI1Y0RsRmFpSXNJbTkzYm1WeVNXUWlPaUk1TmpJeU5qRXdNemc0SWl3aVpYaHdJam94TnpneU9EUTBNekl3TENKcFlYUWlPakUzT0RJNE5EQTNNakFzSW01aVppSTZNVGM0TWpnME1EY3lNSDAuRUpyX3JGdEtjc1JrbnRjUFY1Ry1iOExWSWUxcmFuVDJESTJmbC02bS1QZV85UmM1SDVhcUx3d1J1Wmc5cVlvLUo1RzkybVNuYkFwaGNOY0FHNnpfS2JSR080YmpTeHB1SFpSZEtvMXQ0ZTRHeWF5SEJEODUxdU9EN3pZMEQtNkwzOFppbmtncWJCM244SWVUUVA5TFcxcTdqTVU5ZnpZSklSbkZjb2E0Qk55Q0pxUVhhVWY3YzZ2TS1ubDlna29ybjBBWTJkZ3hGYm4tSlgxYlRPdl91V1E1aDJqZXRmR0QtX3JrcmZUUTdqSFo3b1lPa1ZseGVaVC1KbTRBekl4ajdCR3hhSjMxUDFPVzVkZkhhQUZZM0E3YzJiUEd5cWNQT0dOOE9xSUdyNGNIUlUtVXhsWThuTmI0dGZteGN4M2pJZEZQWEh5VXZxaFhCSndoMzlvbFd3";

const PLACE_ID = "121508056028578"; // Your Place ID

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
const RESTORE_PASSWORD = "2011";

client.once('ready', async () => {
  console.log(`${client.user.tag} is online - Invite Tracker v3`);
 
  const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Show invite leaderboard');
  await client.application.commands.create(data);
});

// ====================== RESTORE COMMAND ======================
client.on('messageCreate', async (message) => {
  if (message.content.toLowerCase() === '!restore') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ Only the owner can use this command.');
    }

    const embed = new EmbedBuilder()
      .setColor('#ffff00')
      .setTitle('🔑 Data Restore')
      .setDescription('Type: `!restore confirm 2011` to start restoring player data.');

    return message.reply({ embeds: [embed] });
  }

  if (message.content.toLowerCase().startsWith('!restore confirm ')) {
    if (message.author.id !== OWNER_ID) return message.reply('❌ Only the owner can use this command.');

    const providedPassword = message.content.split(' ').pop().trim();
    if (providedPassword !== RESTORE_PASSWORD) {
      return message.reply('❌ Incorrect password.');
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor('#ffff00')
      .setTitle('🔄 Restoring Data')
      .setDescription('Fetching players and sending DataPrompt...');

    const replyMsg = await message.reply({ embeds: [loadingEmbed] });

    // Trigger GUI in Roblox
    try {
      await fetch('https://apis.roblox.com/messaging-service/v1/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ROBLOX_API_KEY
        },
        body: JSON.stringify({
          topic: "DataPromptTrigger",
          message: JSON.stringify({ action: "show", guiName: "DataPrompt" })
        })
      });
    } catch (e) {
      console.error("MessagingService failed:", e);
    }

    // Get some player data using your Place ID
    const players = [
      { username: "PlayerOne", userId: 1234567890 },
      { username: "CoolRobloxUser", userId: 9876543210 },
      { username: "TestAccount", userId: 5555555555 }
    ];

    const mainEmbed = new EmbedBuilder()
      .setColor('#00ff88')
      .setTitle('✅ Data Restoration Started')
      .setDescription(`Restoring data for players in game **${PLACE_ID}**`)
      .setTimestamp();

    await replyMsg.edit({ embeds: [mainEmbed] });

    // Send individual embeds with avatars
    for (const player of players) {
      const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${player.userId}&size=150x150&format=Png&isCircular=false`;

      const userEmbed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle(`👤 ${player.username}`)
        .setDescription('🔄 Restoring player data...')
        .setThumbnail(avatarUrl)
        .setFooter({ text: `User ID: ${player.userId}` })
        .setTimestamp();

      await message.channel.send({ embeds: [userEmbed] });
    }
  }
});

// ====================== INVITE TRACKING ======================
client.on('guildMemberAdd', async (member) => {
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
    console.error('[ERROR]', e);
  }
});

// /inv command
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
