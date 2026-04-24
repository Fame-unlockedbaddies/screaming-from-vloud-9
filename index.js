client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const userId = message.author.id;
  const member = message.member;

  // Count messages
  const count = (messageCounts[userId] || 0) + 1;
  messageCounts[userId] = count;
  saveJSON(COUNT_FILE, messageCounts);

  // Remove role if upgraded
  if (member.roles.cache.has(UPGRADE_ROLE_ID)) {
    if (member.roles.cache.has(MESSAGE_ROLE_ID)) {
      await member.roles.remove(MESSAGE_ROLE_ID).catch(() => {});
    }
    return;
  }

  // Give role after 10 messages
  if (count >= 10 && !member.roles.cache.has(MESSAGE_ROLE_ID)) {

    await member.roles.add(MESSAGE_ROLE_ID).catch(console.error);

    const channel = message.guild.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!channel) return console.log("❌ Channel not found");

    const role = message.guild.roles.cache.get(MESSAGE_ROLE_ID);

    const embed = new EmbedBuilder()
      .setDescription(
        `🎉 <@${userId}> you have received this role <@&${MESSAGE_ROLE_ID}>\n` +
        `You have received the Fame Newgen role!`
      )
      .setColor(0xff69b4)
      .setThumbnail(role?.iconURL())
      .setTimestamp();

    // ✅ FORCE MENTIONS + PUBLIC MESSAGE
    await channel.send({
      content: `<@${userId}>`, // 🔥 THIS FORCES THE TAG
      embeds: [embed],
      allowedMentions: {
        users: [userId], // 🔥 ENSURES TAG WORKS
        roles: [MESSAGE_ROLE_ID],
      },
    });
  }
});
