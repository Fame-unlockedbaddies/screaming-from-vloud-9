console.log('>>> BOT STARTING <<<');

const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/', (req, res) => res.send('Bot online!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

console.log('TOKEN?', !!process.env.TOKEN);
console.log('SECRET?', !!process.env.ROBLOX_SECRET);
console.log('Node', process.version);

const SECRET = process.env.ROBLOX_SECRET || 'change-me';
const cache = new Map(); // userId -> { username, avatar, data, updatedAt }

app.post('/roblox-data', (req, res) => {
  if (req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad secret');
  const { userId, username, avatar, data } = req.body || {};
  if (!userId || !data) return res.status(400).send('missing');
  cache.set(String(userId), { username, avatar, data, updatedAt: Date.now() });
  console.log(`push ${userId} ${username}`);
  res.send('ok');
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on(Events.Error, e => console.error('Discord error:', e));

const BLOCKED = ['password','pass','backup','code','token','acsession','secret','recovery'];
function sanitize(o) {
  if (!o || typeof o !== 'object') return o;
  const c = Array.isArray(o) ? [...o] : {...o};
  for (const k of Object.keys(c)) {
    if (BLOCKED.some(b => k.toLowerCase().includes(b))) c[k] = '[HIDDEN]';
    else if (typeof c[k] === 'object') c[k] = sanitize(c[k]);
  }
  if (c.ACSession) c.ACSession = '[HIDDEN]';
  return c;
}

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (msg.content === '!ping') return msg.reply('pong!');
  if (msg.content === '!cache') return msg.reply(`cached players: ${cache.size}`);

  if (msg.content.startsWith('!fetch')) {
    const arg = msg.content.split(' ').slice(1)[0];
    if (!arg) return msg.reply('Usage: `!fetch <roblox username or userId>`');

    let entry = cache.get(String(arg));
    let userId = String(arg);
    if (!entry) {
      for (const [id, v] of cache) {
        if (v.username && v.username.toLowerCase() === String(arg).toLowerCase()) {
          entry = v; userId = id; break;
        }
      }
    }
    if (!entry) return msg.reply(`No data for \`${arg}\` yet. Join game once to push, then try. Cached: ${cache.size}`);

    const data = sanitize(entry.data);
    let thumb = entry.avatar;
    try {
      if (!thumb) {
        const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb = t.data?.[0]?.imageUrl;
      }
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle(`${entry.username || 'Unknown'} (${userId})`)
      .setURL(`https://www.roblox.com/users/${userId}/profile`)
      .setThumbnail(thumb || null)
      .addFields(
        { name: 'Money', value: String(data.Money ?? 0), inline: true },
        { name: 'Slays', value: String(data.Slays ?? 0), inline: true },
        { name: 'Updated', value: `<t:${Math.floor(entry.updatedAt/1000)}:R>`, inline: true },
      )
      .setDescription('```json\n' + JSON.stringify({ Money: data.Money, Slays: data.Slays, RAPs: data.RAPs }, null, 2).slice(0, 900) + '\n```')
      .setFooter({ text: 'Passwords / backup codes never shown' });

    return msg.reply({ embeds: [embed] });
  }
});

if (!process.env.TOKEN) {
  console.error('❌ NO TOKEN in Render Environment');
} else {
  client.login(process.env.TOKEN).catch(e => console.error('❌ LOGIN FAILED:', e.message));
}
