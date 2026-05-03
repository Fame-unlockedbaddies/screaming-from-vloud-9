process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

// ---------------- WEB SERVER ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Cálido running");
});

app.listen(PORT, "0.0.0.0");

// ---------------- BOT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("make")
    .setDescription("Create audio")
    .addSubcommand(sub =>
      sub
        .setName("audio")
        .addStringOption(opt =>
          opt.setName("genre")
            .setDescription("Genre (phonk, pop, etc)")
            .setRequired(true)
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- SIMPLE AUDIO GENERATOR ----------------
function generateToneWav(filename) {
  const sampleRate = 44100;
  const duration = 5;
  const samples = sampleRate * duration;

  const buffer = Buffer.alloc(44 + samples * 2);

  function writeString(offset, str) {
    buffer.write(str, offset);
  }

  // WAV header
  writeString(0, "RIFF");
  buffer.writeUInt32LE(36 + samples * 2, 4);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  writeString(36, "data");
  buffer.writeUInt32LE(samples * 2, 40);

  // Generate sound (simple sine wave beat)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = 440 + Math.sin(t * 5) * 100;
    const sample = Math.sin(2 * Math.PI * freq * t);

    buffer.writeInt16LE(sample * 32767, 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
}

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (
    interaction.commandName === "make" &&
    interaction.options.getSubcommand() === "audio"
  ) {
    const genre = interaction.options.getString("genre");

    await interaction.deferReply();

    const filePath = path.join(__dirname, "song.wav");

    generateToneWav(filePath);

    await interaction.editReply({
      content: `Generated ${genre} style audio`,
      files: [filePath]
    });

    fs.unlinkSync(filePath);
  }
});

client.once("ready", () => {
  console.log("Cálido online");
});

client.login(TOKEN);
