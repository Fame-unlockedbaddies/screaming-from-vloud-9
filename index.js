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
   DISCORD BOT
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

/* =========================
   CUSTOM EMOJI SYSTEM
========================= */

function convertCustomEmojis(text, guild) {

  if (!text) return text;

  const regex = /:([a-zA-Z0-9_]+):/g;

  text = text.replace(regex, (match, emojiName) => {

    const emoji =
      guild.emojis.cache.find(
        e => e.name === emojiName
      );

    if (emoji) {
      return `<:${emoji.name}:${emoji.id}>`;
    }

    return match;

  });

  return text;

}

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  /* =========================
     PING
  ========================= */

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping command'),

  /* =========================
     SEND MESSAGE
  ========================= */

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
        .setDescription('Embed image')
        .setRequired(false)
    ),

  /* =========================
     SET TICKET
  ========================= */

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
        .setDescription('Panel image')
        .setRequired(false)
    ),

  /* =========================
     AUTO ROLE
  ========================= */

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
   INTERACTIONS
========================= */

client.on('interactionCreate', async interaction => {

  if (interaction.isChatInputCommand()) {

    /* =========================
       PING
    ========================= */

    if (interaction.commandName === 'ping') {

      return interaction.reply({
        content: 'Pong!'
      });

    }

    /* =========================
       SEND MESSAGE
    ========================= */

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
        content: 'Message sent',
        ephemeral: true
      });

    }

    /* =========================
       SET TICKET
    ========================= */

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
        content: 'Ticket panel sent',
        ephemeral: true
      });

    }

    /* =========================
       AUTO ROLE
    ========================= */

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

        if (member.roles.cache.has(role.id))
          continue;

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
     DROPDOWN MENU
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
          .setColor('#8b5cf6');

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

    /* =========================
       CLAIM
    ========================= */

    if (interaction.customId === 'claim_ticket') {

      const ticketOwnerId =
        interaction.channel.topic;

      const isOwner =
        interaction.user.id === ticketOwnerId;

      const hasStaffRole =
        interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels
        );

      if (
        isOwner &&
        !hasStaffRole
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

    /* =========================
       CLOSE
    ========================= */

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
   AUTO ROLE JOIN EVENT
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
   LOGIN
========================= */

client.login(TOKEN);
