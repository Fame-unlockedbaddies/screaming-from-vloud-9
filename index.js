// ==================== OAUTH2 - "Join servers for you" ====================

const express = require('express');
const fetch = require('node-fetch');

const webApp = express();

const PORT = process.env.PORT || 3000;                    // ← Fixed here
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = "1448798824415101030";                   // Your server ID

// IMPORTANT: Change this when your bot is on Render
const REDIRECT_URI = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}/callback`;
// For local testing it will use localhost, on Render it will use your actual domain

// Login route
webApp.get('/login', (req, res) => {
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify+guilds.join`;
    res.redirect(authUrl);
});

// Callback route
webApp.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) return res.send("❌ No code received from Discord.");

    if (!CLIENT_SECRET) {
        return res.send("❌ CLIENT_SECRET is missing. Please add it in Render Environment Variables.");
    }

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) return res.send("❌ Failed to get access token.");

        // Get user ID
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = await userRes.json();
        const userId = user.id;

        // Join user to server
        const joinRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_token: accessToken })
        });

        if (joinRes.ok || joinRes.status === 201 || joinRes.status === 204) {
            res.send(`✅ Success! You have been added to the server.`);
            console.log(`✅ User ${userId} joined via OAuth2`);
        } else {
            res.send(`❌ Failed to join the server.`);
        }
    } catch (err) {
        console.error(err);
        res.send("❌ Something went wrong.");
    }
});

// Start the web server
webApp.listen(PORT, () => {
    console.log(`🚀 OAuth2 server running on port ${PORT}`);
    console.log(`→ Login link: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}/login`);
});
