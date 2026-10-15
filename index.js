console.log('>>> BOT STARTING <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
app.listen(process.env.PORT || 3000, () => console.log('Web on'));

const SECRET = process.env.ROBLOX_SECRET;
const cache = new Map();
const cooldown = new Map(); // discordUserId -> timestamp
const fetching = new Set(); // prevent overlap spam
const IGNORE_WEAPONS = ['punches','punch','spray','wallet','fists'];

console.log('TOKEN?', !!process.env.TOKEN, 'SECRET?', !!SECRET);

app.post('/roblox-data', (req, res) => {
  try {
    if (req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
    const { userId, username, avatar, data, backup, weapons } = req.body || {};
    if (!userId || !data) return res.status(400).send('missing');
    const cleanW = (weapons || []).filter(w => {
      const n = String(w.name || '').toLowerCase();
      return n && !IGNORE_WEAPONS.some(i => n.includes(i));
    }).slice(0, 30);
    cache.set(String(userId), { username, avatar, data, backup, weapons: cleanW, updatedAt: Date.now() });
    res.send('ok');
  } catch(e){ console.error('push err', e.message); res.status(500).send('err'); }
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, () => console.log(`✅ Logged in as ${client.user.tag}`));
client.on(Events.Error, e => console.error('discord err', e.message));

function getDinero(data){
  // your leaderstats Dinero = replion Money
  return data.Money ?? data.Dinero ?? data.Cash ?? 0;
}
function getTradeTokens(data){
  // Trade Tokens / TokenAmount
  try{
    return data.NewInventory?.Tokens ?? data.Tokens ?? data.TokenAmount ?? data.Underground?.NewTokens ?? 0;
  }catch{ return 0; }
}

async function assetToThumb(ids){
  const map = {};
  for(let i=0;i<ids.length;i+=40){
    const batch = ids.slice(i,i+40).join(',');
    try{
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 8000);
      const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${batch}&size=150x150&format=Png`, {signal:ctrl.signal}).then(r=>r.json());
      clearTimeout(t);
      for(const d of (r.data||[])) if(d.imageUrl) map[String(d.targetId)] = d.imageUrl;
    }catch(e){ console.error('thumb fail', e.message); }
  }
  return map;
}

client.on(Events.MessageCreate, async msg => {
  try{
    if(msg.author.bot || !msg.guild) return;
    const content = msg.content.trim();

    if(content === '!ping') return void await msg.reply('pong!').catch(()=>{});

    if(content === '!all' || content === '!cache'){
      if(!cache.size) return void await msg.reply('No pushes yet. Join game first.').catch(()=>{});
      const list = [...cache.entries()].slice(0,20).map(([id,v])=>`${v.username} (${id})`).join('\n').slice(0,1800);
      return void await msg.reply(`**Cached ${cache.size}:**\n${list}`).catch(()=>{});
    }

    if(!content.startsWith('!fetch')) return;
    const now = Date.now();
    const last = cooldown.get(msg.author.id) || 0;
    if(now - last < 3000){
      return void await msg.reply('Slow down - wait 3s between fetches.').catch(()=>{});
    }
    cooldown.set(msg.author.id, now);

    const key = `${msg.author.id}:${content}`;
    if(fetching.has(key)) return; // already handling this exact spam
    fetching.add(key);
    try{
      const arg = content.split(/\s+/).slice(1)[0];
      if(!arg){ await msg.reply('Usage: `!fetch <roblox name or Id>`').catch(()=>{}); return; }

      let entry, userId = String(arg);
      entry = cache.get(userId);
      if(!entry){
        const low = String(arg).toLowerCase();
        for(const [id,v] of cache){ if(v.username?.toLowerCase()===low){ entry=v; userId=id; break; } }
      }
      if(!entry){ await msg.reply(`No data for \`${arg}\`. Join Unlock It once to push. Cached: ${cache.size}`).catch(()=>{}); return; }

      await msg.channel.sendTyping().catch(()=>{});

      const data = entry.data || {};
      const dinero = getDinero(data);
      const tradeTokens = getTradeTokens(data);
      const weapons = entry.weapons || [];

      let thumb = entry.avatar;
      try{
        if(!thumb){
          const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
          thumb = t.data?.[0]?.imageUrl;
        }
      }catch{}

      let thumbMap = {};
      try{
        thumbMap = await assetToThumb([...new Set(weapons.map(w=>w.iconAsset).filter(Boolean))]);
      }catch{}

      const main = new EmbedBuilder()
        .setTitle(`${entry.username || 'Unknown'} (${userId})`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setColor(0x2b2d31);
      if(thumb) main.setThumbnail(thumb);
      main.addFields(
        {name:'💵 Dinero', value:String(dinero), inline:true},
        {name:'🪙 Trade Tokens (TokenAmount)', value:String(tradeTokens), inline:true},
        {name:'🔪 Weapons', value:String(weapons.length), inline:true},
      );
      if(entry.backup?.savedAt) main.addFields({name:'☁️ Backup First-Join', value:`${entry.backup.reason||'first-join'} <t:${entry.backup.savedAt}:R>`, inline:false});
      main.setFooter({text:'Punches/Spray/Wallet hidden • passwords never shown'});

      const embeds = [main];
      for(const w of weapons.slice(0,9)){
        try{
          const e = new EmbedBuilder().setTitle(String(w.name).slice(0,100)).setDescription(String(w.rarity||'').slice(0,50));
          const img = thumbMap[String(w.iconAsset)];
          if(img) e.setThumbnail(img);
          embeds.push(e);
        }catch{}
      }
      if(weapons.length>9) embeds[0].addFields({name:'+ more', value:`+${weapons.length-9} more`, inline:false});

      // chunk to 10 embeds max (discord limit) - never throws
      for(let i=0;i<embeds.length;i+=10){
        await msg.reply({embeds:embeds.slice(i,i+10)}).catch(async ()=>{
          await msg.channel.send({embeds:embeds.slice(i,i+10)}).catch(()=>{});
        });
        if(i+10 < embeds.length) await new Promise(r=>setTimeout(r,500));
      }
    }finally{
      fetching.delete(key);
    }
  }catch(e){
    console.error('fetch handler err', e.message);
    try{ await msg.reply('Fetch hiccup, try again.').catch(()=>{}); }catch{}
  }
});

process.on('unhandledRejection', e => console.error('unhandled', e?.message));
process.on('uncaughtException', e => console.error('uncaught', e?.message));

if(!process.env.TOKEN) console.error('❌ NO TOKEN');
else client.login(process.env.TOKEN).catch(e=>console.error('LOGIN FAILED', e.message));
