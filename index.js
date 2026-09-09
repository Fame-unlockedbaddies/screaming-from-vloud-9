// ===============================================
// TOR-UNA DISCORD BOT - FIXED FOR YOUR VARS
// ===============================================

require('dotenv').config();

const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// ======================
// COMMANDS
// ======================

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // Ping
  if (cmd === 'ping') {
    const sent = await message.reply('🏓 **Pong!**');
    const ping = client.ws.ping;
    await sent.edit(`🏓 **Pong!** \`${ping}ms\``);
  }

  // 8ball
  if (cmd === '8ball') {
    const responses = ['Yes, definitely.', 'No way.', 'Maybe...', 'Ask again later.', 'Outlook not so good.', 'As I see it, yes.', 'You may rely on it.'];
    const reply = responses[Math.floor(Math.random() * responses.length)];
    message.reply(`🎱 **8-Ball Says:** ${reply}`);
  }

  // Tor-UNA special
  if (cmd === 'tor') {
    const torReplies = ['Yes, perfect for Tor.', 'No, not recommended.', 'You should try it.', 'Absolutely not.', 'Depends on your setup.', '100% yes.'];
    const reply = torReplies[Math.floor(Math.random() * torReplies.length)];
    message.reply(`🕵️ **Tor-UNA Says:** ${reply}`);
  }

  if (cmd === 'help' || cmd === 'h') {
    message.reply('**Tor-UNA Bot Commands**\n`!ping` - Check latency\n`!8ball` - 8-ball magic\n`!tor` - Tor-UNA advice\n`!help` - This menu');
  }
});

// ======================
// READY
// ======================

client.once(Events.ClientReady, () => {
  console.log(`✅ ${client.user.tag} is online and ready! (using CLIENT_ID: ${process.env.CLIENT_ID})`);

  client.user.setActivity({
    name: 'Tor-UNA Mode Activated',
    type: ActivityType.Playing
  });
});

// ======================
// LOGIN WITH YOUR VARS
// ======================

client.login(process.env.TOKEN);
