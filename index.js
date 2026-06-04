const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const express = require('express');
require('dotenv').config();

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Online');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Web server running on port ${process.env.PORT || 3000}`);
});

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ======================================================
// STAFF ROLES
// ======================================================

const STAFF_ROLES = [
  'YOUR_STAFF_ROLE_ID_HERE',
  'YOUR_STAFF_ROLE_ID_HERE'
];

// ======================================================
// ROLES TO DM WHEN AUTOMOD FIRES
// ======================================================

const NOTIFY_ROLES = [
  'YOUR_NOTIFY_ROLE_ID_HERE',
  'YOUR_NOTIFY_ROLE_ID_HERE'
];

// ======================================================
// BLOCKED WORDS
// ======================================================

const BLOCKED_WORDS = [
  'playgrounds',
  'fame 2.0',
  'jay',
  'dm me'
];

// ======================================================
// AUTOMOD CONFIG
// ======================================================

const AUTOMOD_CONFIG = {
  inviteTimeoutMs: 5 * 60 * 1000,
  inviteTimeoutReason: 'Posted invite link',
  inviteEmbedColor: '#ff0000',
  blockedWordEmbedColor: '#ff0000',
  blockedWordDeleteMs: 3000
};

// ======================================================
// PENDING PANEL SESSIONS
// Stores modal answers per user while they go through
// the setup flow before the panel is posted
// ======================================================

const pendingSessions = {};

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ======================================================
// TICKET COUNTS
// ======================================================

const ticketCounts = {};

// ======================================================
// COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Set up and send the ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this ticket')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim this ticket')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to this ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to add')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from this ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to remove')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename this ticket channel')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('New channel name')
        .setRequired(true)
    )
    .toJSON()

];

// ======================================================
// REGISTER COMMANDS — GUILD SCOPED (instant)
// ======================================================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Commands Loaded (guild)');

  } catch (err) {

    console.log(err);

  }

})();

// ======================================================
// READY
// ======================================================

client.once('ready', () => {

  console.log(`${client.user.tag} Online`);

});

// ======================================================
// STAFF CHECK
// ======================================================

function isStaff(member) {

  return STAFF_ROLES.some(role =>
    member.roles.cache.has(role)
  );

}

// ======================================================
// AUTOMOD
// ======================================================

client.on('messageCreate', async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.toLowerCase();

  // ====================================================
  // BLOCK INVITES
  // ====================================================

  if (
    content.includes('discord.gg/') ||
    content.includes('discord.com/invite/') ||
    content.includes('discordapp.com/invite/')
  ) {

    await message.delete().catch(() => {});

    await message.member.timeout(
      AUTOMOD_CONFIG.inviteTimeoutMs,
      AUTOMOD_CONFIG.inviteTimeoutReason
    ).catch(() => {});

    await message.channel.send({

      embeds: [

        new EmbedBuilder()
          .setColor(AUTOMOD_CONFIG.inviteEmbedColor)
          .setDescription(
            `${message.author} invite links are not allowed.`
          )

      ]

    });

    for (const roleId of NOTIFY_ROLES) {

      const role = message.guild.roles.cache.get(roleId);

      if (!role) continue;

      for (const member of role.members.values()) {

        member.send({
          content: `The bot has timed out ${message.author} for posting an invite link.`
        }).catch(() => {});

      }

    }

    return;

  }

  // ====================================================
  // BLOCK WORDS
  // ====================================================

  for (const word of BLOCKED_WORDS) {

    if (content.includes(word)) {

      await message.delete().catch(() => {});

      const warn = await message.channel.send({

        embeds: [

          new EmbedBuilder()
            .setColor(AUTOMOD_CONFIG.blockedWordEmbedColor)
            .setDescription(
              `${message.author} we do not use that word.`
            )

        ]

      });

      setTimeout(() => {

        warn.delete().catch(() => {});

      }, AUTOMOD_CONFIG.blockedWordDeleteMs);

      return;

    }

  }

});

// ======================================================
// INTERACTIONS
// ======================================================

client.on('interactionCreate', async interaction => {

  // ====================================================
  // /SETTICKET — open modal step 1 (panel config)
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'setticket'
  ) {

    const modal = new ModalBuilder()
      .setCustomId('setup_panel')
      .setTitle('Ticket Panel Setup');

    const titleInput = new TextInputBuilder()
      .setCustomId('panel_title')
      .setLabel('Panel Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Support Tickets')
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('panel_desc')
      .setLabel('Panel Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g. Select a category below to open a ticket.')
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId('panel_color')
      .setLabel('Panel Embed Colour (HEX)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. #5865F2')
      .setRequired(true);

    const ticketColorInput = new TextInputBuilder()
      .setCustomId('ticket_color')
      .setLabel('Ticket Embed Colour (HEX)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. #2b2d31')
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('panel_image')
      .setLabel('Panel Banner Image URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://... or leave blank')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput),
      new ActionRowBuilder().addComponents(ticketColorInput),
      new ActionRowBuilder().addComponents(imageInput)
    );

    await interaction.showModal(modal);

    return;

  }

  // ====================================================
  // MODAL SUBMIT — step 1 (panel config saved)
  // Now show step 2: category IDs + emojis
  // ====================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === 'setup_panel'
  ) {

    const panelTitle = interaction.fields.getTextInputValue('panel_title');
    const panelDesc = interaction.fields.getTextInputValue('panel_desc');
    const panelColor = interaction.fields.getTextInputValue('panel_color');
    const ticketColor = interaction.fields.getTextInputValue('ticket_color');
    const panelImage = interaction.fields.getTextInputValue('panel_image') || null;

    // Save step 1 to session
    pendingSessions[interaction.user.id] = {
      panelTitle,
      panelDesc,
      panelColor,
      ticketColor,
      panelImage,
      channelId: interaction.channelId
    };

    // Open step 2 modal — category IDs
    const modal2 = new ModalBuilder()
      .setCustomId('setup_categories')
      .setTitle('Category IDs (right-click category > Copy ID)');

    const cat1 = new TextInputBuilder()
      .setCustomId('cat_content_creator')
      .setLabel('Apply for Content Creator — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const cat2 = new TextInputBuilder()
      .setCustomId('cat_report_hacker')
      .setLabel('Report a Hacker — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const cat3 = new TextInputBuilder()
      .setCustomId('cat_cc_rewards')
      .setLabel('CC Rewards — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const cat4 = new TextInputBuilder()
      .setCustomId('cat_bug_reports')
      .setLabel('Bug Reports — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const cat5 = new TextInputBuilder()
      .setCustomId('cat_feedback')
      .setLabel('Feedback — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    modal2.addComponents(
      new ActionRowBuilder().addComponents(cat1),
      new ActionRowBuilder().addComponents(cat2),
      new ActionRowBuilder().addComponents(cat3),
      new ActionRowBuilder().addComponents(cat4),
      new ActionRowBuilder().addComponents(cat5)
    );

    await interaction.showModal(modal2);

    return;

  }

  // ====================================================
  // MODAL SUBMIT — step 2 (first 5 category IDs saved)
  // Now show step 3: remaining 2 category IDs + emojis
  // ====================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === 'setup_categories'
  ) {

    const session = pendingSessions[interaction.user.id];

    if (!session) {

      return interaction.reply({
        content: 'Session expired. Please run /setticket again.',
        ephemeral: true
      });

    }

    session.cat_content_creator = interaction.fields.getTextInputValue('cat_content_creator');
    session.cat_report_hacker = interaction.fields.getTextInputValue('cat_report_hacker');
    session.cat_cc_rewards = interaction.fields.getTextInputValue('cat_cc_rewards');
    session.cat_bug_reports = interaction.fields.getTextInputValue('cat_bug_reports');
    session.cat_feedback = interaction.fields.getTextInputValue('cat_feedback');

    // Open step 3 modal — last 2 categories + emojis
    const modal3 = new ModalBuilder()
      .setCustomId('setup_emojis')
      .setTitle('Last Categories + Emojis');

    const cat6 = new TextInputBuilder()
      .setCustomId('cat_report_staff')
      .setLabel('Report a Staff — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const cat7 = new TextInputBuilder()
      .setCustomId('cat_report_admin')
      .setLabel('Report an Admin — Category ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1234567890123456789')
      .setRequired(true);

    const emojiInput = new TextInputBuilder()
      .setCustomId('emojis')
      .setLabel('Emojis (one per line, match order below)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        'Content Creator\nReport Hacker\nCC Rewards\nBug Reports\nFeedback\nReport Staff\nReport Admin\n\nLeave a line blank for no emoji.\nUse <:name:id> for custom emojis.'
      )
      .setRequired(false);

    modal3.addComponents(
      new ActionRowBuilder().addComponents(cat6),
      new ActionRowBuilder().addComponents(cat7),
      new ActionRowBuilder().addComponents(emojiInput)
    );

    await interaction.showModal(modal3);

    return;

  }

  // ====================================================
  // MODAL SUBMIT — step 3 (all data collected)
  // Build and post the panel
  // ====================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === 'setup_emojis'
  ) {

    await interaction.deferReply({ ephemeral: true });

    const session = pendingSessions[interaction.user.id];

    if (!session) {

      return interaction.editReply({
        content: 'Session expired. Please run /setticket again.'
      });

    }

    session.cat_report_staff = interaction.fields.getTextInputValue('cat_report_staff');
    session.cat_report_admin = interaction.fields.getTextInputValue('cat_report_admin');

    const emojiRaw = interaction.fields.getTextInputValue('emojis') || '';
    const emojiLines = emojiRaw.split('\n');

    const getEmoji = (index) => {
      const e = (emojiLines[index] || '').trim();
      return e.length > 0 ? e : null;
    };

    const ticketOptions = [
      {
        label: 'Apply for Content Creator',
        emoji: getEmoji(0),
        categoryId: session.cat_content_creator,
        prefix: 'content-creator'
      },
      {
        label: 'Report a Hacker',
        emoji: getEmoji(1),
        categoryId: session.cat_report_hacker,
        prefix: 'report-hacker'
      },
      {
        label: 'CC Rewards',
        emoji: getEmoji(2),
        categoryId: session.cat_cc_rewards,
        prefix: 'cc-rewards'
      },
      {
        label: 'Bug Reports',
        emoji: getEmoji(3),
        categoryId: session.cat_bug_reports,
        prefix: 'bug-report'
      },
      {
        label: 'Feedback',
        emoji: getEmoji(4),
        categoryId: session.cat_feedback,
        prefix: 'feedback'
      },
      {
        label: 'Report a Staff',
        emoji: getEmoji(5),
        categoryId: session.cat_report_staff,
        prefix: 'report-staff'
      },
      {
        label: 'Report an Admin',
        emoji: getEmoji(6),
        categoryId: session.cat_report_admin,
        prefix: 'report-admin'
      }
    ];

    // Build panel embed
    const embed = new EmbedBuilder()
      .setColor(session.panelColor)
      .setTitle(session.panelTitle)
      .setDescription(session.panelDesc)
      .setFooter({ text: 'Select a category below' })
      .setTimestamp();

    if (
      session.panelImage &&
      (
        session.panelImage.startsWith('https://') ||
        session.panelImage.startsWith('http://')
      )
    ) {
      embed.setImage(session.panelImage);
    }

    // Build dropdown
    const menuOptions = ticketOptions.map((opt, index) => {

      const option = {
        label: opt.label,
        value: String(index)
      };

      if (opt.emoji) {
        option.emoji = opt.emoji;
      }

      return option;

    });

    const menuId = `ticket_menu_${interaction.user.id}_${Date.now()}`;

    const menu = new StringSelectMenuBuilder()
      .setCustomId(menuId)
      .setPlaceholder('Open a Ticket')
      .addOptions(menuOptions);

    const row = new ActionRowBuilder().addComponents(menu);

    // Store ticket options mapped to this menu ID
    // so we know which categories/prefixes to use
    pendingSessions[menuId] = {
      ticketOptions,
      ticketColor: session.ticketColor
    };

    // Post the panel to the channel where /setticket was run
    const channel = interaction.guild.channels.cache.get(session.channelId);

    if (!channel) {

      return interaction.editReply({
        content: 'Could not find the channel. Please try again.'
      });

    }

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    // Clean up user session
    delete pendingSessions[interaction.user.id];

    await interaction.editReply({
      content: 'Ticket panel created successfully.'
    });

    return;

  }

  // ====================================================
  // DROPDOWN — CREATE TICKET
  // ====================================================

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith('ticket_menu_')) {

      try {

        await interaction.deferReply({ ephemeral: true });

        const session = pendingSessions[interaction.customId];

        if (!session) {

          return interaction.editReply({
            content: 'This panel is no longer active. Ask an admin to run /setticket again.'
          });

        }

        const optionIndex = parseInt(interaction.values[0]);
        const selected = session.ticketOptions[optionIndex];

        if (!selected) {

          return interaction.editReply({
            content: 'Invalid ticket option.'
          });

        }

        const { label, categoryId, prefix } = selected;

        if (!ticketCounts[categoryId]) {
          ticketCounts[categoryId] = 1;
        } else {
          ticketCounts[categoryId]++;
        }

        const ticketNumber = ticketCounts[categoryId];

        const channel = await interaction.guild.channels.create({

          name: `${prefix}-${ticketNumber}`,

          type: ChannelType.GuildText,

          parent: categoryId,

          topic: interaction.user.id,

          permissionOverwrites: [

            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },

            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }

          ]

        });

        const buttons = new ActionRowBuilder()

          .addComponents(

            new ButtonBuilder()
              .setCustomId('claim_ticket')
              .setLabel('Claim Ticket')
              .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)

          );

        const embed = new EmbedBuilder()
          .setColor(session.ticketColor)
          .setTitle('Support Ticket')
          .setDescription(
            `Welcome ${interaction.user}\n\nPlease explain your issue and wait for staff to respond.`
          )
          .setFooter({ text: `Category: ${label}` })
          .setTimestamp();

        await channel.send({
          content: `${interaction.user}`,
          embeds: [embed],
          components: [buttons]
        });

        await interaction.editReply({
          content: `Your ticket was created: ${channel}`
        });

      } catch (err) {

        console.log(err);

        if (!interaction.replied) {
          interaction.reply({
            content: 'Failed to create ticket.',
            ephemeral: true
          }).catch(() => {});
        }

      }

    }

  }

  // ====================================================
  // /CLOSE
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'close'
  ) {

    const ownerId = interaction.channel.topic;
    const isOwner = interaction.user.id === ownerId;
    const staff = isStaff(interaction.member);

    if (!isOwner && !staff) {

      return interaction.reply({
        content: 'Only the ticket owner or staff can close this ticket.',
        ephemeral: true
      });

    }

    await interaction.reply({

      embeds: [

        new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription('Ticket closing in 5 seconds.')

      ]

    });

    setTimeout(async () => {

      await interaction.channel.delete().catch(() => {});

    }, 5000);

  }

  // ====================================================
  // /CLAIM
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'claim'
  ) {

    if (!isStaff(interaction.member)) {

      return interaction.reply({
        content: 'Only staff can claim tickets.',
        ephemeral: true
      });

    }

    await interaction.reply({

      embeds: [

        new EmbedBuilder()
          .setColor('#00ff00')
          .setDescription(`${interaction.user} claimed this ticket.`)

      ]

    });

  }

  // ====================================================
  // /ADD
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'add'
  ) {

    if (!isStaff(interaction.member)) {

      return interaction.reply({
        content: 'Only staff can add users to tickets.',
        ephemeral: true
      });

    }

    const user = interaction.options.getUser('user');

    await interaction.channel.permissionOverwrites.edit(user, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    await interaction.reply({

      embeds: [

        new EmbedBuilder()
          .setColor('#00ff00')
          .setDescription(`${user} has been added to this ticket.`)

      ]

    });

  }

  // ====================================================
  // /REMOVE
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'remove'
  ) {

    if (!isStaff(interaction.member)) {

      return interaction.reply({
        content: 'Only staff can remove users from tickets.',
        ephemeral: true
      });

    }

    const user = interaction.options.getUser('user');

    await interaction.channel.permissionOverwrites.edit(user, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false
    });

    await interaction.reply({

      embeds: [

        new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(`${user} has been removed from this ticket.`)

      ]

    });

  }

  // ====================================================
  // /RENAME
  // ====================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'rename'
  ) {

    if (!isStaff(interaction.member)) {

      return interaction.reply({
        content: 'Only staff can rename tickets.',
        ephemeral: true
      });

    }

    const name = interaction.options.getString('name');

    await interaction.channel.setName(name).catch(() => {});

    await interaction.reply({

      embeds: [

        new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(`Ticket renamed to **${name}**.`)

      ]

    });

  }

  // ====================================================
  // BUTTONS
  // ====================================================

  if (interaction.isButton()) {

    // ==================================================
    // CLAIM BUTTON
    // ==================================================

    if (interaction.customId === 'claim_ticket') {

      if (!isStaff(interaction.member)) {

        return interaction.reply({
          content: 'Only staff can claim tickets.',
          ephemeral: true
        });

      }

      await interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor('#00ff00')
            .setDescription(`${interaction.user} claimed this ticket.`)

        ]

      });

    }

    // ==================================================
    // CLOSE BUTTON
    // ==================================================

    if (interaction.customId === 'close_ticket') {

      const ownerId = interaction.channel.topic;
      const isOwner = interaction.user.id === ownerId;
      const staff = isStaff(interaction.member);

      if (!isOwner && !staff) {

        return interaction.reply({
          content: 'Only the ticket owner or staff can close this ticket.',
          ephemeral: true
        });

      }

      await interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('Ticket closing in 5 seconds.')

        ]

      });

      setTimeout(async () => {

        await interaction.channel.delete().catch(() => {});

      }, 5000);

    }

  }

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
