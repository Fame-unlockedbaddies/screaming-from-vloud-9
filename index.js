const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const express = require('express');
require('dotenv').config();

/* =========================
   EXPRESS SERVER
========================= */

const app = express();

app.get('/', (req, res) => {
  res.send('Bot online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* =========================
   BOT SETUP
========================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* =========================
   VARIABLES
========================= */

const ticketCategories = new Map();

let ticketCount = 0;

let autoRoleId = null;

const MEMBER_ROLE_ID = '1505041194156167339';
const QAQ_ROLE_ID = '1497660027274530927';
const CONTENT_CREATOR_ROLE_ID = '1502715193975771257';

/* =========================
   CUSTOM EMOJI SYSTEM
========================= */

function convertCustomEmojis(text, guild) {

  if (!text) return text;

  const regex = /:([a-zA-Z0-9_]+):/g;

  return text.replace(regex, (match, emojiName) => {

    const emoji =
      guild.emojis.cache.find(
        e => e.name === emojiName
      );

    if (emoji) {
      return `<:${emoji.name}:${emoji.id}>`;
    }

    return match;

  });

}

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping command'),

  new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('Send embed message')

    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Embed title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Embed description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Embed image URL')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Create ticket panel')

    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Panel title')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Panel description')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Panel color')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('report_category')
        .setDescription('Report category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_category')
        .setDescription('General category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_category')
        .setDescription('Creator category ID')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('report_emoji')
        .setDescription('Report emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('general_emoji')
        .setDescription('General emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('creator_emoji')
        .setDescription('Creator emoji')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Panel image URL')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Set auto role')

    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to give members')
        .setRequired(true)
    )

].map(command => command.toJSON());

/* =========================
   REGISTER COMMANDS
========================= */

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

(async () => {

  try {

    console.log('Loading commands...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Commands loaded');

  } catch (error) {

    console.error(error);

  }

})();

/* =========================
   READY
========================= */

client.once('ready', () => {

  console.log(
    `Logged in as ${client.user.tag}`
  );

});

/* =========================
   INTERACTION CREATE
========================= */

client.on('interactionCreate', async interaction => {

  /* =========================
     SLASH COMMANDS
  ========================= */

  if (interaction.isChatInputCommand()) {

    /* PING */

    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    /* SEND MESSAGE */

    if (interaction.commandName === 'sendmessage') {

      let title =
        interaction.options.getString('title');

      let description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

      title =
        convertCustomEmojis(
          title,
          interaction.guild
        );

      description =
        convertCustomEmojis(
          description,
          interaction.guild
        );

      const embed =
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      await interaction.channel.send({
        embeds: [embed]
      });

      await interaction.reply({
        content: 'Message sent.',
        ephemeral: true
      });

    }

    /* SET TICKET */

    if (interaction.commandName === 'setticket') {

      let title =
        interaction.options.getString('title');

      let description =
        interaction.options.getString('description');

      const color =
        interaction.options.getString('color');

      const image =
        interaction.options.getString('image');

      title =
        convertCustomEmojis(
          title,
          interaction.guild
        );

      description =
        convertCustomEmojis(
          description,
          interaction.guild
        );

      const reportCategory =
        interaction.options.getString(
          'report_category'
        );

      const generalCategory =
        interaction.options.getString(
          'general_category'
        );

      const creatorCategory =
        interaction.options.getString(
          'creator_category'
        );

      const reportEmoji =
        interaction.options.getString(
          'report_emoji'
        );

      const generalEmoji =
        interaction.options.getString(
          'general_emoji'
        );

      const creatorEmoji =
        interaction.options.getString(
          'creator_emoji'
        );

      ticketCategories.set(
        'report',
        reportCategory
      );

      ticketCategories.set(
        'general',
        generalCategory
      );

      ticketCategories.set(
        'creator',
        creatorCategory
      );

      const embed =
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color);

      if (image) {
        embed.setImage(image);
      }

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId('ticket_menu')
          .setPlaceholder('Choose section')

          .addOptions([

            {
              label: 'Report a Exploiter',
              description: 'Report support',
              value: 'report',
              emoji: reportEmoji
            },

            {
              label: 'General',
              description: 'General support',
              value: 'general',
              emoji: generalEmoji
            },

            {
              label: 'Content Creator',
              description: 'Creator support',
              value: 'creator',
              emoji: creatorEmoji
            }

          ]);

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({
        content: 'Ticket panel sent.',
        ephemeral: true
      });

    }

    /* AUTO ROLE */

    if (interaction.commandName === 'autorole') {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {

        return interaction.reply({
          content:
            'You need Administrator permission.',
          ephemeral: true
        });

      }

      const role =
        interaction.options.getRole('role');

      autoRoleId = role.id;

      const members =
        await interaction.guild.members.fetch();

      let given = 0;

      for (const [, member] of members) {

        if (member.user.bot) continue;

        if (
          member.roles.cache.has(role.id)
        ) continue;

        try {

          await member.roles.add(role.id);

          given++;

        } catch (err) {

          console.log(err);

        }

      }

      await interaction.reply({
        content:
          `Auto role set to ${role}. Gave role to ${given} members.`,
        ephemeral: true
      });

    }

  }

  /* =========================
     TICKET MENU
  ========================= */

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'ticket_menu') {

      const guild =
        interaction.guild;

      const member =
        interaction.member;

      const ticketType =
        interaction.values[0];

      const categoryId =
        ticketCategories.get(ticketType);

      const existingTicket =
        guild.channels.cache.find(
          channel =>
            channel.topic === member.id
        );

      if (existingTicket) {

        return interaction.reply({
          content:
            `You already have a ticket ${existingTicket}`,
          ephemeral: true
        });

      }

      ticketCount++;

      const ticketChannel =
        await guild.channels.create({

          name:
            `ticket-${ticketCount}`,

          topic:
            member.id,

          type:
            ChannelType.GuildText,

          parent:
            categoryId,

          permissionOverwrites: [

            {
              id:
                guild.id,

              deny: [
                PermissionsBitField
                  .Flags
                  .ViewChannel
              ]
            },

            {
              id:
                member.id,

              allow: [
                PermissionsBitField
                  .Flags
                  .ViewChannel,

                PermissionsBitField
                  .Flags
                  .SendMessages,

                PermissionsBitField
                  .Flags
                  .ReadMessageHistory
              ]
            }

          ]

        });

      const claimButton =
        new ButtonBuilder()
          .setCustomId('claim_ticket')
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Primary);

      const closeButton =
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

      const row =
        new ActionRowBuilder()
          .addComponents(
            claimButton,
            closeButton
          );

      const ticketEmbed =
        new EmbedBuilder()
          .setTitle('TICKET')
          .setDescription(
            `Welcome to Fame support ${member}`
          )
          .setColor('#ff1493');

      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.reply({
        content:
          `Your ticket has been created ${ticketChannel}`,
        ephemeral: true
      });

    }

  }

  /* =========================
     BUTTONS
  ========================= */

  if (interaction.isButton()) {

    if (interaction.customId === 'claim_ticket') {

      const ticketOwnerId =
        interaction.channel.topic;

      const isOwner =
        interaction.user.id === ticketOwnerId;

      const hasStaffPermission =
        interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels
        );

      if (
        isOwner &&
        !hasStaffPermission
      ) {

        return interaction.reply({
          content:
            'You cannot claim your own ticket.',
          ephemeral: true
        });

      }

      await interaction.reply({
        content:
          `${interaction.user} claimed this ticket.`
      });

    }

    if (interaction.customId === 'close_ticket') {

      await interaction.reply({
        content:
          'Closing ticket in 5 seconds...',
        ephemeral: true
      });

      setTimeout(async () => {

        await interaction.channel.delete();

      }, 5000);

    }

  }

});

/* =========================
   AUTO ROLE
========================= */

client.on('guildMemberAdd', async member => {

  if (member.user.bot) return;

  if (!autoRoleId) return;

  try {

    await member.roles.add(autoRoleId);

  } catch (err) {

    console.log(err);

  }

});

/* =========================
   ROLE DM SYSTEM
========================= */

client.on('guildMemberUpdate', async (oldMember, newMember) => {

  /* MEMBER ROLE */

  const hadMemberRole =
    oldMember.roles.cache.has(
      MEMBER_ROLE_ID
    );

  const hasMemberRole =
    newMember.roles.cache.has(
      MEMBER_ROLE_ID
    );

  if (
    !hadMemberRole &&
    hasMemberRole
  ) {

    try {

      const memberEmbed =
        new EmbedBuilder()

          .setColor('#ff1493')

          .setTitle('Welcome to Fame')

          .setDescription(`
# **Hello ${newMember}!**

# **Congratulations!**
**You have officially received the Member role in Fame.**

**This role gives you access to be part of the Fame community, interact with other players, and stay updated with announcements, events, and future updates.**

**Please make sure to follow the community rules at all times.**

# **Things you must not do to community members or staff:**

• **Do not disrespect, insult, or harass members or staff**
• **Do not start drama, arguments, or toxic behavior**
• **Do not spam chats or misuse channels**
• **Do not spread false information or rumors**
• **Do not leak private information or upcoming content**
• **Do not threaten, troll, or target other members**
• **Do not bypass rules or encourage others to break rules**
• **Do not impersonate staff members or higher roles**

# **Punishments**
**Failure to follow these rules may result in warnings, mutes, or removal from the community.**

# **Thank you for being part of Fame.**
`)

          .setThumbnail(
            newMember.user.displayAvatarURL()
          )

          .setFooter({
            text: 'Fame Community'
          });

      await newMember.send({
        embeds: [memberEmbed]
      });

    } catch (err) {

      console.log(err);

    }

  }

  /* QAQ ROLE */

  const hadQAQRole =
    oldMember.roles.cache.has(
      QAQ_ROLE_ID
    );

  const hasQAQRole =
    newMember.roles.cache.has(
      QAQ_ROLE_ID
    );

  if (
    !hadQAQRole &&
    hasQAQRole
  ) {

    try {

      const qaqEmbed =
        new EmbedBuilder()

          .setColor('#0099ff')

          .setTitle('QAQ Manager Role')

          .setDescription(`
# **Congratulations!**

${newMember}

**You have officially been given the QAQ Manager role in Fame.**

**This role recognizes your presence, support, and involvement within the community. QAQ Manager is a respected position that represents trust, professionalism, and dedication inside Fame.**

**With this role, you are now part of a higher level within the community and will have access to additional features, management areas, and future opportunities as Fame continues to grow.**

# **Role Information:**

• **Official QAQ Manager status within Fame**
• **Access to exclusive management-related channels**
• **Ability to communicate with higher-level staff members**
• **Recognition as part of the trusted community team**
• **Eligibility for future projects, events, and updates**
• **Closer involvement with upcoming Fame systems and releases**
• **Expanded access within the community environment**

# **Things You Should Do:**

• **Remain respectful and professional at all times**
• **Help support and guide community members when needed**
• **Report problems or rule violations to higher staff**
• **Stay active and involved within the community**
• **Represent Fame positively inside and outside the server**
• **Work together with staff members professionally**

# **Things You Must Not Do:**

• **Do not abuse your role or permissions**
• **Do not disrespect members or staff**
• **Do not leak private staff information or upcoming content**
• **Do not start arguments, drama, or toxic behavior**
• **Do not misuse management channels or staff access**
• **Do not impersonate higher staff positions**
• **Do not bypass rules or encourage others to break rules**

**Failure to follow expectations may result in warnings, role removal, or further moderation action.**

**Thank you for supporting Fame and being part of the community.**
`)

          .setThumbnail(
            newMember.user.displayAvatarURL()
          )

          .setFooter({
            text: 'Fame Community'
          });

      await newMember.send({
        embeds: [qaqEmbed]
      });

    } catch (err) {

      console.log(err);

    }

  }

  /* CONTENT CREATOR ROLE */

  const hadCreatorRole =
    oldMember.roles.cache.has(
      CONTENT_CREATOR_ROLE_ID
    );

  const hasCreatorRole =
    newMember.roles.cache.has(
      CONTENT_CREATOR_ROLE_ID
    );

  if (
    !hadCreatorRole &&
    hasCreatorRole
  ) {

    try {

      const creatorEmbed =
        new EmbedBuilder()

          .setColor('#ffff00')

          .setTitle('Content Creator Role')

          .setDescription(`
# **Congratulations!**

${newMember}

**You have officially received the Content Creator role in Fame.**

**This role is given to members who help support and represent Fame through content creation, creativity, activity, and community engagement. Your work and dedication are appreciated by the Fame community.**

**As a Content Creator, you are now recognized as an official creator within Fame and may receive access to creator-related opportunities, announcements, and future projects.**

# **Role Information:**

• **Official Content Creator status within Fame**
• **Recognition for supporting the community through content**
• **Access to creator-related channels and updates**
• **Eligibility for future creator opportunities and events**
• **Closer involvement with upcoming Fame releases and announcements**
• **Ability to collaborate and communicate with staff members**

# **Things You Should Do:**

• **Create positive and appropriate content related to Fame**
• **Represent the community professionally**
• **Remain active and supportive within the server**
• **Encourage community engagement and growth**
• **Work respectfully with members and staff**

# **Things You Must Not Do:**

• **Do not create harmful, misleading, or inappropriate content**
• **Do not leak private information or upcoming content**
• **Do not misuse your creator status for personal gain**
• **Do not disrespect members, creators, or staff**
• **Do not spread drama, toxicity, or false information**
• **Do not impersonate higher staff roles or official announcements**

**Failure to follow expectations may result in warnings, role removal, or further moderation action.**

**Thank you for supporting Fame and contributing to the community.**
`)

          .setThumbnail(
            newMember.user.displayAvatarURL()
          )

          .setFooter({
            text: 'Fame Community'
          });

      await newMember.send({
        embeds: [creatorEmbed]
      });

    } catch (err) {

      console.log(err);

    }

  }

});

/* =========================
   LOGIN
========================= */

client.login(TOKEN);
