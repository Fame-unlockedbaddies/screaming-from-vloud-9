// ===============================================
// TOR-UNA DISCORD BOT - FULLY WORKING 2026
// Install: npm install
// Deploy on Render: npm run start
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

  // 8ball (Tor-UNA style)
  if (cmd === '8ball') {
    const responses = [
      'Yes, definitely.', 'No way.', 'Maybe...', 'Ask again later.',
      'Outlook not so good.', 'As I see it, yes.', 'You may rely on it.',
      'Signs point to yes.', 'Concentrate and ask again.',
      'It is certain.', 'Without a doubt.', 'Yes - definitely.'
    ];
    const reply = responses[Math.floor(Math.random() * responses.length)];
    message.reply(`🎱 **8-Ball Says:** ${reply}`);
  }

  // 8ball (fun Tor-UNA mode)
  if (cmd === 'tor') {
    const torReplies = [
      'Yes, perfect for Tor.',
      'No, not recommended.',
      'You should try it.',
      'Absolutely not.',
      'Depends on your setup.',
      '100% yes.',
      'Try it and see.',
      'Tor-UNA approves ✅'
    ];
    const reply = torReplies[Math.floor(Math.random() * torReplies.length)];
    message.reply(`🕵️ **Tor-UNA Says:** ${reply}`);
  }

  // Help command
  if (cmd === 'help' || cmd === 'h') {
    const helpMsg = `**Tor-UNA Bot Commands**  
    \`!ping\` - Check bot latency  
    \`!8ball <question>\` - 8-ball magic  
    \`!tor <question>\` - Tor-UNA advice  
    \`!help\` - This menu`;
    message.reply(helpMsg);
  }
});

// ======================
// READY EVENT
// ======================

client.once(Events.ClientReady, () => {
  console.log(`✅ ${client.user.tag} is online and ready for Tor-UNA!`);

  // Set status
  client.user.setActivity({
    name: 'Tor-UNA Mode Activated',
    type: ActivityType.Playing
  });

  // Optional: DM welcome (uncomment if you want)
  // client.guilds.cache.forEach(guild => {
  //   guild.members.fetch().then(members => {
  //     members.forEach(member => {
  //       if (!member.user.bot) {
  //         member.send('👋 Welcome to Tor-UNA Discord Bot! Type `!help` for commands.');
  //       }
  //     });
  //   });
  // });
});

client.login(process.env.TOKEN);
