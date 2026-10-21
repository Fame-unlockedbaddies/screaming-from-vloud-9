console.log('>>> BOOT <<<');

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');

const TOKEN = (process.env.TOKEN || '').trim();
console.log('TOKEN present:', !!TOKEN);

const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.get('/health', (req, res) => res.send('ok'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('WEB ON ' + PORT));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('error', (e) => console.error('CLIENT ERROR:', e && e.message ? e.message : e));
client.on('warn', (m) => console.warn('CLIENT WARN:', m));
process.on('unhandledRejection', (e) => console.error('UNHANDLED REJECTION:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('UNCAUGHT EXCEPTION:', e && e.message ? e.message : e));

client.once(Events.ClientReady, () => {
  console.log('========================================');
  console.log('LOGGED IN AS:', client.user.username, '(' + client.user.tag + ')');
  console.log('BOT ID:', client.user.id);
  console.log('GUILDS:', client.guilds.cache.size);
  console.log('========================================');
});

if (!TOKEN) {
  console.error('NO TOKEN FOUND - set TOKEN env var on Render.');
} else {
  console.log('Waiting 15s before connecting (rate-limit safety)...');
  setTimeout(() => {
    let attempt = 0;
    const maxAttempts = 5;
    function tryLogin() {
      attempt++;
      console.log('Login attempt', attempt, 'of', maxAttempts);
      client.login(TOKEN)
        .then(() => console.log('client.login() resolved. Bot should be online now.'))
        .catch((e) => {
          console.error('LOGIN FAILED:', e && e.message ? e.message : e, '| code:', e && e.code);
          if (attempt < maxAttempts) {
            const delay = Math.min(30000 * attempt, 120000);
            console.log('Retrying in', delay / 1000, 'seconds...');
            setTimeout(tryLogin, delay);
          } else {
            console.error('All login attempts failed. Stopping.');
          }
        });
    }
    tryLogin();
  }, 15000);
}
