// ================= SMART BLACKLIST FILTER =================

// NORMAL CONTENT
const normalContent = content.toLowerCase();

// CONTENT WITH SPACES REMOVED
const compactContent = normalContent.replace(/\s+/g, "");

// ALLOW THIS SPECIFIC DOG GIF
const hasAllowedDogGif =
  normalContent.includes(
    "https://tenor.com/view/h2di-dog-side-eye-awkward-gif-7599485883499901089"
  ) ||
  normalContent.includes(
    "h2di-dog-side-eye-awkward-gif"
  );

// FIND BLOCKED WORD
const foundWord = blacklist.find(word => {

  const compactWord =
    word.toLowerCase().replace(/\s+/g, "");

  // ================= ALLOW SPECIFIC DOG GIF =================
  if (
    compactWord === "dog" &&
    hasAllowedDogGif
  ) {
    return false;
  }

  // ================= ALLOW IMAGE/GIF ATTACHMENTS FOR DOG =================
  if (
    compactWord === "dog" &&
    message.attachments.size > 0
  ) {
    return false;
  }

  // ================= NORMAL CHECK =================
  if (normalContent.includes(word.toLowerCase())) {
    return true;
  }

  // ================= SPACE BYPASS CHECK =================
  // EXAMPLE:
  // d o g
  // f a g
  // k y s
  if (compactContent.includes(compactWord)) {
    return true;
  }

  return false;

});

if (foundWord) {

  await message.delete();

  // ================= ADVANCED WARNING EMBED =================
  const warningEmbed = new EmbedBuilder()

    .setColor("#ff1493")

    .setAuthor({
      name: "Advanced Moderation System",
      iconURL: client.user.displayAvatarURL()
    })

    .setTitle("⚠ Message Removed")

    .setDescription(
      [
        "> Your message triggered the protection system.",
        "",
        "### Detected Word",
        `\`\`\`${foundWord}\`\`\``,
        "> Please avoid using restricted language."
      ].join("\n")
    )

    .addFields(
      {
        name: "Status",
        value: "```diff\n- Blocked Automatically\n```",
        inline: true
      },
      {
        name: "Action",
        value: "```yaml\nDM Warning Sent\n```",
        inline: true
      },
      {
        name: "System",
        value: "```fix\nAdvanced Protection Online\n```",
        inline: true
      }
    )

    .setThumbnail(client.user.displayAvatarURL())

    .setFooter({
      text: "Advanced Protection • Active"
    })

    .setTimestamp();

  await message.author.send({
    embeds: [warningEmbed]
  });

  console.log(
    `Deleted message from ${message.author.tag} for using: ${foundWord}`
  );

  return;
}
