const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  PermissionFlagsBits
} = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// Web server for Render
const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Data storage
const dataPath = './data.json';
let data = {
  prefixes: {},
  welcome: {}
};

if (fs.existsSync(dataPath)) {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getPrefix(guildId) {
  return data.prefixes[guildId] || ',';
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Welcome event
client.on(Events.GuildMemberAdd, async (member) => {
  const welcomeConfig = data.welcome[member.guild.id];
  if (!welcomeConfig || !welcomeConfig.channelId) return;

  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) return;

  // Give the role
  try {
    await member.roles.add('1531850889357299892');
  } catch (err) {
    console.error('Failed to give role:', err);
  }

  const joinDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`;
  const banner = welcomeConfig.banner || null;

  const welcomeEmbed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Welcome')
    .setDescription(`Welcome ${member} to **${member.guild.name}**`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: 'User', value: `${member.user.tag}`, inline: true },
      { name: 'Account Created', value: joinDate, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();

  if (banner) {
    welcomeEmbed.setImage(banner);
  }

  channel.send({ content: `${member}`, embeds: [welcomeEmbed] }).catch(() => {});
});

// Message commands
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = getPrefix(message.guild.id);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ping
  if (command === 'ping') {
    return message.reply('Pong!');
  }

  // prefix
  if (command === 'prefix') {
    if (args[0] === 'set') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('You need Manage Server permission to change the prefix.');
      }
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) {
        return message.reply('Please provide a valid prefix (max 5 characters).');
      }
      data.prefixes[message.guild.id] = newPrefix;
      saveData();
      return message.reply(`Prefix has been changed to \`${newPrefix}\``);
    }
    return message.reply(`Current prefix is \`${prefix}\``);
  }

  // help
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help')
      .setDescription('List of available commands')
      .addFields(
        { name: 'ping', value: 'Check if the bot is online', inline: true },
        { name: 'prefix', value: 'Show or change the prefix', inline: true },
        { name: 'lock', value: 'Lock the current channel', inline: true },
        { name: 'unlock', value: 'Unlock the current channel', inline: true },
        { name: 'welcomer', value: 'Set the welcome channel + banner', inline: true },
        { name: 'testwelcome', value: 'Test the welcome message', inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
  }

  // lock
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });

      const lockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Locked')
        .setDescription(`This channel has been locked by **${message.author.tag}**.\n\nMembers can no longer send messages.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [lockEmbed] });
    } catch (err) {
      return message.reply('Failed to lock the channel.');
    }
  }

  // unlock
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });

      const unlockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Unlocked')
        .setDescription(`This channel has been unlocked by **${message.author.tag}**.\n\nMembers can now send messages again.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [unlockEmbed] });
    } catch (err) {
      return message.reply('Failed to unlock the channel.');
    }
  }

  // welcomer
  if (command === 'welcomer') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply(`Usage: \`${prefix}welcomer #channel\``);
    }

    // Ask for banner image
    const askEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome Setup')
      .setDescription(`Welcome channel set to ${channel}.\n\nPlease upload a **banner image** in the next message (you have 60 seconds).`)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    await message.reply({ embeds: [askEmbed] });

    const filter = (m) => m.author.id === message.author.id && m.attachments.size > 0;
    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
      errors: ['time']
    }).catch(() => null);

    if (!collected) {
      return message.channel.send('Timed out. Please run the command again and upload an image.');
    }

    const imageMessage = collected.first();
    const bannerUrl = imageMessage.attachments.first().url;

    data.welcome[message.guild.id] = {
      channelId: channel.id,
      banner: bannerUrl
    };
    saveData();

    const successEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome System Ready')
      .setDescription(`Welcome messages will be sent in ${channel}`)
      .setImage(bannerUrl)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    return message.channel.send({ embeds: [successEmbed] });
  }

  // testwelcome
  if (command === 'testwelcome') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const welcomeConfig = data.welcome[message.guild.id];
    if (!welcomeConfig) {
      return message.reply('Welcome system is not set up yet. Use `,welcomer #channel` first.');
    }

    const member = message.member;
    const joinDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`;
    const banner = welcomeConfig.banner || null;

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome')
      .setDescription(`Welcome ${member} to **${member.guild.name}**`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: 'User', value: `${member.user.tag}`, inline: true },
        { name: 'Account Created', value: joinDate, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    if (banner) {
      welcomeEmbed.setImage(banner);
    }

    return message.reply({ content: `${member}`, embeds: [welcomeEmbed] });
  }
});

client.login(process.env.TOKEN);
