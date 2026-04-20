else if (sub === "emoji") {
  const unicodeEmoji = role.unicodeEmoji;
  const hasCustomIcon = !!role.icon;

  if (!unicodeEmoji && !hasCustomIcon) {
    return interaction.reply({
      content: `❌ **${role.name}** has neither an emoji nor a custom icon.`,
      ephemeral: true
    });
  }

  let replyContent = "";
  let embedDesc = "";
  const components = [];

  if (unicodeEmoji) {
    replyContent = `**Emoji for ${role.name}:** ${unicodeEmoji}`;
    embedDesc = `**Unicode Emoji:** ${unicodeEmoji}\n\n` +
                `→ Just highlight the emoji above and copy it (Ctrl+C).`;
  }

  if (hasCustomIcon) {
    const iconURL = role.iconURL({ extension: 'png', size: 512 });

    if (embedDesc) embedDesc += "\n\n";
    embedDesc += `**Custom Role Icon:**\n[View Full Size](${iconURL})`;

    const downloadBtn = new ButtonBuilder()
      .setLabel("⬇️ Download Icon Image")
      .setStyle(ButtonStyle.Link)
      .setURL(iconURL);

    components.push(new ActionRowBuilder().addComponents(downloadBtn));
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Role Emoji / Icon — ${role.name}`)
    .setDescription(embedDesc || "No additional information.")
    .setColor(role.color || 0x2f3136)
    .setTimestamp();

  await interaction.reply({
    content: replyContent || null,
    embeds: [embed],
    components: components
  });
}
