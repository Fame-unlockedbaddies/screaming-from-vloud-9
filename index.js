const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// ===== Web server for Render =====
const app = express();
app.get('/', (req, res) => res.send('Petal is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
// =================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ===== Simple data storage =====
const dataPath = './data.json';
let data = {
  economy: {},
  warns: {},
  welcome: {},
  tickets: {}
};

if (fs.existsSync(dataPath)) {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getBalance(userId) {
  if (!data.economy[userId]) data.economy[userId] = { bal: 0, lastDaily: 0, lastWork: 0 };
  return data.economy[userId];
}

// ===== Slash Commands =====
const commands = [
  // Moderation
  {
    name: 'ban',
    description: 'Ban a member',
    options: [
      { name: 'user', type: 6, description: 'User to ban', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ],
    default_member_permissions: PermissionFlagsBits.BanMembers.toString()
  },
  {
    name: 'kick',
    description: 'Kick a member',
    options: [
      { name: 'user', type: 6, description: 'User to kick', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ],
    default_member_permissions: PermissionFlagsBits.KickMembers.toString()
  },
  {
    name: 'timeout',
    description: 'Timeout a member',
    options: [
      { name: 'user', type: 6, description: 'User to timeout', required: true },
      { name: 'minutes', type: 4, description: 'Duration in minutes', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ],
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
  },
  {
    name: 'warn',
    description: 'Warn a member',
    options: [
      { name: 'user', type: 6, description: 'User to warn', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: true }
    ],
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
  },
  {
    name: 'warnings',
    description: 'View warnings of a member',
    options: [
      { name: 'user', type: 6, description: 'User', required: true }
    ]
  },

  // Economy
  {
    name: 'balance',
    description: 'Check your balance or someone else\'s',
    options: [{ name: 'user', type: 6, description: 'User', required: false }]
  },
  { name: 'daily', description: 'Claim your daily reward' },
  { name: 'work', description: 'Work and earn petals' },
  {
    name: 'pay',
    description: 'Pay another user',
    options: [
      { name: 'user', type: 6, description: 'User to pay', required: true },
      { name: 'amount', type: 4, description: 'Amount', required: true }
    ]
  },

  // Fun / Roleplay
  {
    name: 'hug',
    description: 'Hug someone',
    options: [{ name: 'user', type: 6, description: 'User', required: true }]
  },
  {
    name: 'kiss',
    description: 'Kiss someone',
    options: [{ name: 'user', type: 6, description: 'User', required: true }]
  },
  {
    name: 'slap',
    description: 'Slap someone',
    options: [{ name: 'user', type: 6, description: 'User', required: true }]
  },
  {
    name: 'pat',
    description: 'Pat someone',
    options: [{ name: 'user', type: 6, description: 'User', required: true }]
  },
  {
    name: 'cuddle',
    description: 'Cuddle someone',
    options: [{ name: 'user', type: 6, description: 'User', required: true }]
  },

  // Tickets
  {
    name: 'ticket-setup',
    description: 'Setup the ticket system (Admin only)',
    options: [
      { name: 'category', type: 7, description: 'Category for tickets', required: true },
      { name: 'support-role', type: 8, description: 'Support role', required: true }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  { name: 'ticket', description: 'Create a support ticket' },
  { name: 'close', description: 'Close the current ticket' },

  // Welcome
  {
    name: 'setwelcome',
    description: 'Set the welcome channel and message',
    options: [
      { name: 'channel', type: 7, description: 'Welcome channel', required: true },
      { name: 'message', type: 3, description: 'Message (use {user} and {server})', required: true }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },

  // Utility
  {
    name: 'vc',
    description: 'Makes the bot join the voice channel you are in'
  }
];

// Register commands
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error(err);
  }
});

// ===== Welcome Messages =====
client.on(Events.GuildMemberAdd, async (member) => {
  const welcome = data.welcome[member.guild.id];
  if (!welcome) return;

  const channel = member.guild.channels.cache.get(welcome.channelId);
  if (!channel) return;

  const msg = welcome.message
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, member.guild.name);

  channel.send(msg).catch(() => {});
});

// ===== Interaction Handler =====
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // ---------- BUTTONS (Tickets) ----------
  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const conf = data.tickets[interaction.guild.id];
      if (!conf) {
        return interaction.reply({ content: 'Ticket system is not set up.', ephemeral: true });
      }

      const existing = interaction.guild.channels.cache.find(
        c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.parentId === conf.categoryId
      );
      if (existing) {
        return interaction.reply({ content: `You already have a ticket: ${existing}`, ephemeral: true });
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: conf.categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: conf.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@${interaction.user.id}> <@&${conf.supportRoleId}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Ticket Created')
            .setDescription('Support will be with you shortly.\nClick the button below to close this ticket.')
        ],
        components: [row]
      });

      return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply('Closing ticket in 3 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
    return;
  }

  // ---------- SLASH COMMANDS ----------
  const { commandName, options, member, guild, user } = interaction;

  // ===== MODERATION =====
  if (commandName === 'ban') {
    const target = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const targetMember = await guild.members.fetch(target.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'User not found.', ephemeral: true });
    if (!targetMember.bannable) return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });

    await targetMember.ban({ reason });
    return interaction.reply(`Banned **${target.tag}** | Reason: ${reason}`);
  }

  if (commandName === 'kick') {
    const target = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const targetMember = await guild.members.fetch(target.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'User not found.', ephemeral: true });
    if (!targetMember.kickable) return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });

    await targetMember.kick(reason);
    return interaction.reply(`Kicked **${target.tag}** | Reason: ${reason}`);
  }

  if (commandName === 'timeout') {
    const target = options.getUser('user');
    const minutes = options.getInteger('minutes');
    const reason = options.getString('reason') || 'No reason provided';
    const targetMember = await guild.members.fetch(target.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'User not found.', ephemeral: true });
    if (!targetMember.moderatable) return interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });

    await targetMember.timeout(minutes * 60 * 1000, reason);
    return interaction.reply(`Timed out **${target.tag}** for ${minutes} minute(s) | Reason: ${reason}`);
  }

  if (commandName === 'warn') {
    const target = options.getUser('user');
    const reason = options.getString('reason');

    if (!data.warns[guild.id]) data.warns[guild.id] = {};
    if (!data.warns[guild.id][target.id]) data.warns[guild.id][target.id] = [];

    data.warns[guild.id][target.id].push({
      reason,
      moderator: user.tag,
      date: new Date().toISOString()
    });
    saveData();

    return interaction.reply(`Warned **${target.tag}** | Reason: ${reason}`);
  }

  if (commandName === 'warnings') {
    const target = options.getUser('user');
    const warns = data.warns[guild.id]?.[target.id] || [];

    if (warns.length === 0) {
      return interaction.reply(`${target.tag} has no warnings.`);
    }

    const list = warns.map((w, i) => `**${i + 1}.** ${w.reason} — by ${w.moderator}`).join('\n');
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`Warnings for ${target.tag}`)
          .setDescription(list)
      ]
    });
  }

  // ===== ECONOMY =====
  if (commandName === 'balance') {
    const target = options.getUser('user') || user;
    const bal = getBalance(target.id);
    return interaction.reply(`**${target.username}** has **${bal.bal}** petals.`);
  }

  if (commandName === 'daily') {
    const bal = getBalance(user.id);
    const now = Date.now();
    if (now - bal.lastDaily < 86400000) {
      const left = Math.ceil((86400000 - (now - bal.lastDaily)) / 3600000);
      return interaction.reply(`You already claimed daily. Come back in ~${left} hour(s).`);
    }
    bal.bal += 500;
    bal.lastDaily = now;
    saveData();
    return interaction.reply(`You claimed **500** petals! New balance: **${bal.bal}**`);
  }

  if (commandName === 'work') {
    const bal = getBalance(user.id);
    const now = Date.now();
    if (now - bal.lastWork < 3600000) {
      return interaction.reply('You can only work once per hour.');
    }
    const earned = Math.floor(Math.random() * 150) + 50;
    bal.bal += earned;
    bal.lastWork = now;
    saveData();
    return interaction.reply(`You worked and earned **${earned}** petals! Balance: **${bal.bal}**`);
  }

  if (commandName === 'pay') {
    const target = options.getUser('user');
    const amount = options.getInteger('amount');

    if (amount <= 0) return interaction.reply('Amount must be positive.');
    if (target.id === user.id) return interaction.reply('You cannot pay yourself.');

    const from = getBalance(user.id);
    const to = getBalance(target.id);

    if (from.bal < amount) return interaction.reply('You do not have enough petals.');

    from.bal -= amount;
    to.bal += amount;
    saveData();
    return interaction.reply(`You paid **${amount}** petals to **${target.username}**.`);
  }

  // ===== FUN / ROLEPLAY =====
  const roleplay = {
    hug: ['hugs', 'gave a warm hug to'],
    kiss: ['kisses', 'planted a kiss on'],
    slap: ['slaps', 'slapped'],
    pat: ['pats', 'gently patted'],
    cuddle: ['cuddles', 'cuddled with']
  };

  if (roleplay[commandName]) {
    const target = options.getUser('user');
    const [verb, action] = roleplay[commandName];
    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setDescription(`**${user.username}** ${action} **${target.username}**!`)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ===== TICKETS =====
  if (commandName === 'ticket-setup') {
    const category = options.getChannel('category');
    const role = options.getRole('support-role');

    data.tickets[guild.id] = {
      categoryId: category.id,
      supportRoleId: role.id
    };
    saveData();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Support Tickets')
          .setDescription('Click the button below to open a private support ticket.')
      ],
      components: [row]
    });

    return interaction.reply({ content: 'Ticket system has been set up!', ephemeral: true });
  }

  if (commandName === 'ticket') {
    // Same logic as the button
    const conf = data.tickets[guild.id];
    if (!conf) return interaction.reply({ content: 'Ticket system is not set up. Ask an admin to run `/ticket-setup`.', ephemeral: true });

    const existing = guild.channels.cache.find(
      c => c.name === `ticket-${user.username.toLowerCase()}` && c.parentId === conf.categoryId
    );
    if (existing) return interaction.reply({ content: `You already have a ticket: ${existing}`, ephemeral: true });

    const channel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: conf.categoryId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: conf.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${user.id}> <@&${conf.supportRoleId}>`,
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Ticket Created').setDescription('Support will be with you shortly.')],
      components: [row]
    });

    return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  if (commandName === 'close') {
    if (!interaction.channel.name.startsWith('ticket-')) {
      return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
    }
    await interaction.reply('Closing ticket in 3 seconds...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }

  // ===== WELCOME =====
  if (commandName === 'setwelcome') {
    const channel = options.getChannel('channel');
    const message = options.getString('message');

    data.welcome[guild.id] = {
      channelId: channel.id,
      message
    };
    saveData();

    return interaction.reply({ content: `Welcome message set in ${channel}!`, ephemeral: true });
  }

  // ===== VC =====
  if (commandName === 'vc') {
    if (!member.voice.channel) {
      return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
    }
    try {
      joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
      return interaction.reply({ content: `Joined **${member.voice.channel.name}**!`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: 'Failed to join the voice channel.', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
