require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = (process.env.token || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.client_id || process.env.CLIENT_ID || '').trim();

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('help').setDescription('Shows available commands'),
].map((c) => c.toJSON());

(async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Successfully registered application commands.');
  } catch (e) {
    console.error(e);
  }
})();
