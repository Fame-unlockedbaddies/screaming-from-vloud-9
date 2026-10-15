console.log('>>> BOT FILE LOADED <<<');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`>>> WEB ON ${PORT} <<<`));

const TOKEN = (process.env.TOKEN || '').trim();
const SECRET = process.env.ROBLOX_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';

const cache = new Map();
const cooldown = new Map();
const IGNORE = ['punches','punch','spray','wallet','fists'];

async function sendToCloud(userId, entry){
  try{
    if(!WEBHOOK_URL) return;
    const data = entry.data||{};
    const dinero = data.Money ?? data.Dinero ?? 0;
    const tokens = data.NewInventory?.Tokens ?? data.TokenAmount ?? 0;
    const weapons = entry.weapons||[];

    let thumb = entry.avatar;
    try{
      if(!thumb){
        const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb = t.data?.[0]?.imageUrl;
      }
    }catch{}

    const embed = {
      title: `☁️ ${entry.username} (${userId}) joined`,
      url: `https://www.roblox.com/users/${userId}/profile`,
      color: 0x5865F2,
      thumbnail: thumb ? { url: thumb } : undefined,
      fields: [
        { name: '💵 Dinero', value: String(dinero), inline: true },
        { name: '🪙 Trade Tokens', value: String(tokens), inline: true },
        { name: '🔪 Weapons', value: String(weapons.length), inline: true },
        { name: 'Weapons list', value: weapons.slice(0,15).map(w=>w.name).join(', ').slice(0,900) || 'none', inline: false },
      ],
      footer: { text: `First-push • <t:${Math.floor(Date.now()/1000)}:R>` },
    };
    await fetch(WEBHOOK_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username:'Backup Cloud', embeds:[embed] })
    });
    console.log(`webhook sent ${userId}`);
  }catch(e){ console.error('webhook fail', e.message); }
}

app.post('/roblox-data', (req, res) => {
  try{
    if(req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
    const {userId, username, avatar, data, backup, weapons, reason} = req.body||{};
    if(!userId||!data) return res.status(400).send('missing');
    const isNew = !cache.has(String(userId));
    const cleanW=(weapons||[]).filter(w=>{
      const n=String(w.name||'').toLowerCase();
      return n && !IGNORE.some(i=>n.includes(i));
    }).slice(0,100);
    const entry = {username, avatar, data, backup, weapons:cleanW, updatedAt:Date.now(), reason};
    cache.set(String(userId), entry);
    // auto-send to #cloud on first time we see them OR first-join push
    if(isNew || (reason && String(reason).includes('first-join'))){
      sendToCloud(String(userId), entry); // no await - don't block
    }
    return res.send('ok');
  }catch(e){ return res.status(500).send('err'); }
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, ()=>console.log(`✅ Logged in as ${client.user.tag}`));

const BLOCKED = ['password','passwd','backupcode','backup_code','acsession','secretkey','recoverykey'];
function sanitize(o){
  if(!o||typeof o!=='object') return o;
  const c = Array.isArray(o)?[...o]:{...o};
  for(const k of Object.keys(c)){
    if(BLOCKED.some(b=>k.toLowerCase().includes(b))) c[k]='[HIDDEN]';
    else if(typeof c[k]==='object') c[k]=sanitize(c[k]);
  }
  return c;
}
function getDinero(d){ return d.Money ?? d.Dinero ?? 0; }
function getTokens(d){ try{ return d.NewInventory?.Tokens ?? d.TokenAmount ?? 0; }catch{ return 0; } }

client.on(Events.MessageCreate, async msg=>{
  try{
    if(msg.author.bot) return;
    if(msg.content==='!ping') return void await msg.reply('pong!').catch(()=>{});
    if(msg.content==='!all'){
      if(!cache.size) return void await msg.reply('No pushes yet.').catch(()=>{});
      return void await msg.reply([...cache.entries()].slice(0,20).map(([id,v])=>`${v.username} (${id})`).join('\n')).catch(()=>{});
    }
    if(!msg.content.startsWith('!fetch')) return;
    if(Date.now()-(cooldown.get(msg.author.id)||0)<3000) return void await msg.reply('Wait 3s').catch(()=>{});
    cooldown.set(msg.author.id, Date.now());
    const arg=msg.content.split(/\s+/)[1];
    if(!arg) return void await msg.reply('`!fetch <name or Id>`').catch(()=>{});
    let entry,userId=String(arg);
    entry=cache.get(userId);
    if(!entry) for(const [id,v] of cache){ if(v.username?.toLowerCase()===String(arg).toLowerCase()){entry=v;userId=id;break;} }
    if(!entry) return void await msg.reply(`No data for ${arg}`).catch(()=>{});
    const dinero=getDinero(entry.data||{}), tokens=getTokens(entry.data||{});
    const weapons=entry.weapons||[];
    let thumb=entry.avatar;
    try{
      if(!thumb){
        const t=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`).then(r=>r.json());
        thumb=t.data?.[0]?.imageUrl;
      }
    }catch{}
    const main=new EmbedBuilder()
      .setTitle(`${entry.username} (${userId})`)
      .setURL(`https://www.roblox.com/users/${userId}/profile`)
      .addFields(
        {name:'💵 Dinero', value:String(dinero), inline:true},
        {name:'🪙 Trade Tokens', value:String(tokens), inline:true},
        {name:'🔪 Weapons', value:String(weapons.length), inline:true},
      );
    if(thumb) main.setThumbnail(thumb);
    if(entry.backup?.savedAt) main.addFields({name:'☁️ First-Join', value:`${entry.backup.reason||''} <t:${entry.backup.savedAt}:R>`, inline:false});
    const embeds=[main];
    for(const w of weapons.slice(0,9)){
      const e=new EmbedBuilder().setTitle(String(w.name).slice(0,100)).setDescription(String(w.rarity||''));
      if(w.iconAsset){
        try{
          const tr=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${w.iconAsset}&size=150x150&format=Png`).then(r=>r.json());
          if(tr.data?.[0]?.imageUrl) e.setThumbnail(tr.data[0].imageUrl);
        }catch{}
      }
      embeds.push(e);
    }
    // show rest as text if >9 so ALL weapons still visible
    if(weapons.length>9){
      const rest = weapons.slice(9).map(w=>w.name).join(', ').slice(0,900);
      embeds[0].addFields({name:`+ ${weapons.length-9} more weapons`, value:rest||'...', inline:false});
    }
    await msg.reply({embeds}).catch(()=>{});
  }catch(e){ console.error(e.message); }
});

if(!TOKEN) console.error('❌ NO TOKEN');
else client.login(TOKEN).catch(e=>console.error('❌ LOGIN FAILED:',e.message));
