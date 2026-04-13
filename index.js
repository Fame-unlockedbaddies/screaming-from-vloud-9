const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const watchList = new Map();
const CHECK_INTERVAL = 30000;
const PINK = 0xFF69B4;
const NOT_FOUND_IMG = path.join(__dirname, 'not_found.png');

async function checkUsername(username) {
  try {
    const res = await axios.post('https://auth.roblox.com/v1/usernames/validate', {
      username,
      birthday: '2000-01-01',
      context: 'Signup'
    });
    return res.data.code === 0;
  } catch (e) {
    return null;
  }
}

function startWatching(username, channel, addedBy) {
  if (watchList.has(username.toLowerCase())) return false;

  const interval = setInterval(async () => {
    const available = await checkUsername(username);
    if (available === true) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Username Available')
        .setDescription(`**${username}** is now available on Roblox!`)
        .addFields({ name: 'Claim it now', value: 'https://www.roblox.com/account/signupredir' })
        .setFooter({ text: 'Roblox Username Sniper' })
        .setTimestamp();

      channel.send({ content: `<@${addedBy}>`, embeds: [embed] });
      stopWatching(username);
    }
  }, CHECK_INTERVAL);

  watchList.set(username.toLowerCase(), { interval, addedBy, channelId: channel.id });
  return true;
}

function stopWatching(username) {
  const entry = watchList.get(username.toLowerCase());
  if (!entry) return false;
  clearInterval(entry.interval);
  watchList.delete(username.toLowerCase());
  return true;
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Roblox usernames', { type: 3 });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'snipe') {
    const username = args[0];

    if (!username) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Missing Argument')
        .setDescription('Please provide a username.\n**Usage:** `!snipe <username>`')
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    if (username.length < 3 || username.length > 20) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Invalid Username')
        .setDescription('Roblox usernames must be between 3 and 20 characters.')
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    const started = startWatching(username, message.channel, message.author.id);

    if (!started) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Already Watching')
        .setDescription(`**${username}** is already on the watch list.`)
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle('Now Watching')
      .setDescription(`Watching **${username}** — you will be pinged when it becomes available.`)
      .addFields({ name: 'Check Interval', value: '30 seconds' })
      .setFooter({ text: 'Roblox Username Sniper' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }

  else if (command === 'unsnipe') {
    const username = args[0];

    if (!username) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Missing Argument')
        .setDescription('Please provide a username.\n**Usage:** `!unsnipe <username>`')
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    const stopped = stopWatching(username);

    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle(stopped ? 'Stopped Watching' : 'Not Found')
      .setDescription(stopped
        ? `Removed **${username}** from the watch list.`
        : `**${username}** was not on the watch list.`)
      .setFooter({ text: 'Roblox Username Sniper' });

    message.reply({ embeds: [embed] });
  }

  else if (command === 'watchlist') {
    if (watchList.size === 0) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Watch List')
        .setDescription('No usernames are currently being watched.')
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    const list = [...watchList.keys()].map((u, i) => `\`${i + 1}.\` ${u}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle('Watch List')
      .setDescription(list)
      .setFooter({ text: `${watchList.size} username(s) being watched` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }

  else if (command === 'check') {
    const username = args[0];

    if (!username) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Missing Argument')
        .setDescription('Please provide a username.\n**Usage:** `!check <username>`')
        .setFooter({ text: 'Roblox Username Sniper' });
      return message.reply({ embeds: [embed] });
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle('Checking Username')
      .setDescription(`Checking availability for **${username}**...`)
      .setFooter({ text: 'Roblox Username Sniper' });

    const msg = await message.reply({ embeds: [loadingEmbed] });
    const available = await checkUsername(username);

    if (available === null) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Error')
        .setDescription('Could not check username. Roblox may be rate limiting requests.')
        .setFooter({ text: 'Roblox Username Sniper' });
      return msg.edit({ embeds: [embed] });
    }

    if (available) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Username Available')
        .setDescription(`**${username}** appears to be available!`)
        .addFields({ name: 'Claim it now', value: 'https://www.roblox.com/account/signupredir' })
        .setFooter({ text: 'Roblox Username Sniper' })
        .setTimestamp();
      return msg.edit({ embeds: [embed] });
    } else {
      const attachment = new AttachmentBuilder(NOT_FOUND_IMG, { name: 'not_found.png' });
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle('Username Taken')
        .setDescription(`**${username}** is already taken or unavailable.`)
        .setImage('attachment://not_found.png')
        .setFooter({ text: 'Roblox Username Sniper' })
        .setTimestamp();
      return msg.edit({ embeds: [embed], files: [attachment] });
    }
  }

  else if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle('Roblox Username Sniper')
      .setDescription('Watch for Roblox usernames and get pinged the moment they become available.')
      .addFields(
        { name: '`!snipe <username>`', value: 'Start watching a username' },
        { name: '`!unsnipe <username>`', value: 'Stop watching a username' },
        { name: '`!check <username>`', value: 'Check if a username is available right now' },
        { name: '`!watchlist`', value: 'View all usernames being watched' },
      )
      .setFooter({ text: 'Roblox Username Sniper' });

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.BOT_TOKEN);
