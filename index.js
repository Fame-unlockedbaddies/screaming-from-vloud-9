// ==================== OAUTH2 - "Join servers for you" ====================

const express = require('express');
const fetch = require('node-fetch');

const oauthApp = express();

const CLIENT_SECRET = process.env.CLIENT_SECRET;   // ← Now available from env
const REDIRECT_URI = `http://localhost:${PORT}/callback`;   // For local testing

// For hosting (Replit, Railway, etc.), change this later to:
// const REDIRECT_URI = `https://your-project-name.onrender.com/callback` (or similar)

// Login route - users click this to trigger the permission
oauthApp.get('/login', (req, res) => {
    const scopes = 'identify guilds.join';
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    
    console.log('OAuth2 login link generated');
    res.redirect(authUrl);
});

// Callback route - Discord returns here after authorization
oauthApp.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.send('❌ Authorization failed. No code received.');
    }

    if (!CLIENT_SECRET) {
        return res.send('❌ CLIENT_SECRET is missing in environment variables.');
    }

    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error('Token error:', tokenData);
            return res.send('❌ Failed to get access token.');
        }

        // Get user ID
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const user = await userRes.json();
        const userId = user.id;

        // Add user to your server
        const guildId = "1448798824415101030";   // Your server ID (from ANNOUNCE_CHANNEL_ID or main server)

        const joinRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: accessToken }),
        });

        if (joinRes.ok || joinRes.status === 201 || joinRes.status === 204) {
            res.send(`✅ Success! You have been added to the server. Welcome!`);
            console.log(`✅ Added user ${userId} to the server via OAuth2`);
        } else {
            const errorText = await joinRes.text();
            console.error('Join failed:', errorText);
            res.send(`❌ Could not join the server right now.`);
        }

    } catch (err) {
        console.error('OAuth2 error:', err);
        res.send('❌ Something went wrong during the process.');
    }
});

// Start OAuth2 server
oauthApp.listen(PORT, () => {
    console.log(`✅ Bot + OAuth2 running on port ${PORT}`);
    console.log(`→ Test the authorization here: http://localhost:${PORT}/login`);
});

// Optional: Keep a simple keep-alive on another port if needed (to avoid conflict)
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is alive");
}).listen(PORT + 1);
