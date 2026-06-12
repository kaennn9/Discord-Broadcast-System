const express = require('express');
const router = express.Router();
const botManager = require('./botManager');
const db = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();


// Multer Setup for Avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// Cookie parser middleware
router.use((req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            let [name, ...rest] = cookie.split('=');
            name = name?.trim();
            if (!name) return;
            const value = rest.join('=').trim();
            if (!value) return;
            try {
                req.cookies[name] = JSON.parse(decodeURIComponent(value));
            } catch (e) {
                req.cookies[name] = decodeURIComponent(value);
            }
        });
    }
    next();
});

// Master Authentication Middleware
const requireOwner = (req, res, next) => {
    // Exclude login, invite, and logout routes from master auth
    if (req.path.startsWith('/login') || req.path.startsWith('/invite') || req.path.startsWith('/logout')) {
        return next();
    }
    
    // Allow guest access specifically for their server dashboard
    if (req.path.startsWith('/server/')) {
        const parts = req.path.split('/');
        if (parts.length === 4) {
            const id = parts[2];
            const guildId = parts[3];
            if (req.cookies.guest_access) {
                const access = req.cookies.guest_access;
                if (access.id === id && access.guildId === guildId) {
                    return next(); // Guest is allowed to proceed to their server
                }
            }
        }
    }

    // Require owner session
    if (String(req.cookies.owner_session) !== 'true') {
        return res.redirect('/login');
    }
    next();
};

router.use(requireOwner);

// Login Routes
router.get('/login', (req, res) => {
    if (String(req.cookies.owner_session) === 'true') return res.redirect('/');
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const masterPassword = process.env.MASTER_PASSWORD || 'admin123';
    if (req.body.password === masterPassword) {
        res.setHeader('Set-Cookie', `owner_session=true; Path=/; Max-Age=${30 * 24 * 60 * 60}`); // 30 days
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid master password.' });
    }
});

router.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'owner_session=; Path=/; Max-Age=0');
    res.redirect('/login');
});

// Main Dashboard
router.get('/', (req, res) => {
    // If guest, redirect to their allowed server
    if (req.cookies.guest_access) {
        const { id, guildId } = req.cookies.guest_access;
        return res.redirect(`/server/${id}/${guildId}`);
    }

    const bots = db.get('bots') || {};
    res.render('index', { bots, isDemo: false });
});

// Update Bot Avatar
router.post('/bot/avatar', upload.single('avatar'), async (req, res) => {
    const { id } = req.body;
    if (!req.file) return res.redirect('/?error=no_file');
    try {
        await botManager.updateAvatar(id, req.file.path);
        // Delete local file after updating Discord avatar
        fs.unlinkSync(req.file.path);
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error updating avatar: ' + error.message);
    }
});

// Update Bot Presence
router.post('/bot/presence', async (req, res) => {
    const { id, status, type, text } = req.body;
    try {
        await botManager.updatePresence(id, { status, type, text });
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error updating presence: ' + error.message);
    }
});

// Fetch guilds for a bot token
router.post('/bot/guilds', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

    const { Client, GatewayIntentBits } = require('discord.js');
    const tempClient = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    try {
        await tempClient.login(token);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                tempClient.destroy();
                reject(new Error('Discord login timed out. Please check your token or intents.'));
            }, 6000);
            
            tempClient.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        const guilds = tempClient.guilds.cache.map(g => ({
            id: g.id,
            name: g.name
        }));

        tempClient.destroy();
        res.json({ success: true, guilds });
    } catch (error) {
        try { tempClient.destroy(); } catch (e) {}
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start a new bot
router.post('/bot/start', async (req, res) => {
    const { token, guildId } = req.body;
    try {
        await botManager.startBot(token, guildId);
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Failed to start bot: ' + error.message);
    }
});

// Stop a bot
router.post('/bot/stop', async (req, res) => {
    const { id } = req.body;
    await botManager.stopBot(id);
    res.redirect('/');
});

// Delete a bot completely
router.post('/bot/delete', async (req, res) => {
    const { id } = req.body;
    await botManager.stopBot(id);
    const bots = db.get('bots') || {};
    delete bots[id];
    db.set('bots', bots);
    res.redirect('/');
});

// Helper Management per Guild
router.post('/guild/helper/add', async (req, res) => {
    const { id, guildId, token } = req.body;
    try {
        const bots = db.get('bots') || {};
        
        // Start the bot first to verify token, passing isHelper = true
        const { client, sessionId: actualSessionId } = await botManager.startBot(token, guildId, true);
        
        // Store specifically as a helper for this guild in DB
        const helpers = db.get('guild_helpers') || {};
        if (!helpers[guildId]) helpers[guildId] = [];
        
        // Only add if not already in the helper list
        if (!helpers[guildId].find(h => h.id === actualSessionId)) {
            helpers[guildId].push({ id: actualSessionId, token, botName: client.user.username });
            db.set('guild_helpers', helpers);
        }
        
        if (id && guildId) {
            res.redirect(`/server/${id}/${guildId}`);
        } else {
            res.redirect('back');
        }
    } catch (error) {
        res.status(500).send('Error adding helper: ' + error.message);
    }
});

router.post('/guild/helper/remove', async (req, res) => {
    const { id, guildId, helperId } = req.body;
    const helpers = db.get('guild_helpers') || {};
    if (helpers[guildId]) {
        const helperIndex = helpers[guildId].findIndex(h => h.id === helperId);
        if (helperIndex !== -1) {
            const helper = helpers[guildId][helperIndex];
            await botManager.stopBot(helper.id);
            helpers[guildId].splice(helperIndex, 1);
            db.set('guild_helpers', helpers);
        }
    }
    
    if (id && guildId) {
        res.redirect(`/server/${id}/${guildId}`);
    } else {
        res.redirect('back');
    }
});

router.post('/guild/helpers/restart', async (req, res) => {
    const { id, guildId } = req.body;
    try {
        const helpers = (db.get('guild_helpers') || {})[guildId] || [];
        for (const h of helpers) {
            try {
                await botManager.stopBot(h.id);
                await botManager.startBot(h.token, guildId, true);
            } catch (err) {
                console.error(`Failed to restart helper ${h.botName}:`, err);
            }
        }
        if (id && guildId) {
            res.redirect(`/server/${id}/${guildId}`);
        } else {
            res.redirect('back');
        }
    } catch (error) {
        res.status(500).send('Error restarting helper bots: ' + error.message);
    }
});

router.post('/guild/helper/settings/identity', upload.single('avatar'), async (req, res) => {
    const { id, guildId, helperId, username } = req.body;
    try {
        let botClient = botManager.getClient(helperId);
        if (!botClient) {
            const helpers = db.get('guild_helpers') || {};
            const helper = helpers[guildId]?.find(h => h.id === helperId);
            if (helper && helper.token) {
                const startResult = await botManager.startBot(helper.token, guildId, true);
                botClient = startResult.client;
            }
        }
        if (!botClient) throw new Error('Helper bot is not running and could not be started.');

        // Update username if provided and changed
        if (username && username.trim() !== '') {
            await botClient.user.setUsername(username.trim());
            
            // Update db helper list
            const helpers = db.get('guild_helpers') || {};
            if (helpers[guildId]) {
                const helper = helpers[guildId].find(h => h.id === helperId);
                if (helper) {
                    helper.botName = username.trim();
                    db.set('guild_helpers', helpers);
                }
            }
        }

        // Update avatar if file is uploaded
        if (req.file) {
            await botClient.user.setAvatar(req.file.path);
            fs.unlinkSync(req.file.path);
        }

        if (id && guildId) {
            res.redirect(`/server/${id}/${guildId}?success=helper_identity_updated`);
        } else {
            res.redirect('back');
        }
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).send('Error updating helper bot identity: ' + error.message);
    }
});

router.post('/guild/helper/settings/presence', async (req, res) => {
    const { id, guildId, helperId, status, type, text } = req.body;
    try {
        let botClient = botManager.getClient(helperId);
        if (!botClient) {
            const helpers = db.get('guild_helpers') || {};
            const helper = helpers[guildId]?.find(h => h.id === helperId);
            if (helper && helper.token) {
                const startResult = await botManager.startBot(helper.token, guildId, true);
                botClient = startResult.client;
            }
        }
        if (!botClient) throw new Error('Helper bot is not running and could not be started.');

        const activityType = {
            'playing': 0,
            'streaming': 1,
            'listening': 2,
            'watching': 3,
            'competing': 5
        }[type.toLowerCase()] || 0;

        botClient.user.setPresence({
            status: status,
            activities: [{
                name: text,
                type: activityType,
                url: type.toLowerCase() === 'streaming' ? 'https://www.twitch.tv/discord' : undefined
            }]
        });

        // Save presence details in helper db entry
        const helpers = db.get('guild_helpers') || {};
        if (helpers[guildId]) {
            const helper = helpers[guildId].find(h => h.id === helperId);
            if (helper) {
                helper.presence = { status, type, text };
                db.set('guild_helpers', helpers);
            }
        }

        if (id && guildId) {
            res.redirect(`/server/${id}/${guildId}?success=helper_presence_updated`);
        } else {
            res.redirect('back');
        }
    } catch (error) {
        res.status(500).send('Error updating helper bot presence: ' + error.message);
    }
});

router.post('/guild/helper/webhook', (req, res) => {
    const { id, guildId, webhookUrl } = req.body;
    const settings = db.get('guild_settings') || {};
    if (!settings[guildId]) settings[guildId] = {};
    settings[guildId].webhookUrl = webhookUrl;
    db.set('guild_settings', settings);
    process.env.FAILURE_WEBHOOK_URL = webhookUrl;

    // إرجاع إلى صفحة السيرفر الحالية
    if (id && guildId) {
        res.redirect(`/server/${id}/${guildId}`);
    } else {
        res.redirect('/');
    }
});

// Blacklist Toggle
router.post('/guild/blacklist/toggle', (req, res) => {
    const { guildId, userId } = req.body;
    const blacklistData = db.get('guild_blacklist') || {};
    if (!blacklistData[guildId]) blacklistData[guildId] = [];
    
    const index = blacklistData[guildId].indexOf(userId);
    let isBlacklisted = false;
    
    if (index === -1) {
        blacklistData[guildId].push(userId);
        isBlacklisted = true;
    } else {
        blacklistData[guildId].splice(index, 1);
    }
    
    db.set('guild_blacklist', blacklistData);
    res.json({ success: true, isBlacklisted });
});

// Memory Cache for Stats
const statsCache = new Map();

// Server Dashboard
router.get('/server/:id/:guildId', async (req, res) => {
    const { id, guildId } = req.params;
    
    // Check if guest
    let isGuest = false;
    if (req.cookies.guest_access) {
        const access = req.cookies.guest_access;
        if (access.id !== id || access.guildId !== guildId) {
            return res.status(403).send("Forbidden: You do not have access to this server.");
        }
        isGuest = true;
    }

    const client = botManager.getClient(id);
    if (!client) return res.redirect('/');

    // Check Cache (Cache for 5 minutes)
    const cached = statsCache.get(guildId);
    if (cached && Date.now() - cached.time < 300000) {
        const guildHelpersData = (db.get('guild_helpers') || {})[guildId] || [];
        const enrichedHelpers = guildHelpersData.map((h, index) => {
            const botClient = botManager.getClient(h.id);
            let botId = null;
            if (botClient && botClient.user) {
                botId = botClient.user.id;
            } else if (h.token) {
                try {
                    const parts = h.token.split('.');
                    if (parts.length > 0) {
                        botId = Buffer.from(parts[0], 'base64').toString('utf-8');
                    }
                } catch (e) {
                    console.error('Failed to parse helper bot token for ID:', e);
                }
            }
            return {
                ...h,
                index: index + 1,
                status: botClient && botClient.ws && botClient.ws.status === 0 ? 'online' : 'offline',
                avatar: botClient && botClient.user ? botClient.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png',
                botId
            };
        });
        const settings = db.get('guild_settings') || {};
        const webhookUrl = settings[guildId]?.webhookUrl || '';
        const blacklist = (db.get('guild_blacklist') || {})[guildId] || [];
        
        return res.render('server', { 
            stats: cached.data.stats, 
            id, 
            guildId, 
            guildHelpers: enrichedHelpers, 
            webhookUrl,
            memberList: cached.data.memberList,
            blacklist,
            isGuest,
            mainBotId: client.user.id,
            isDemo: false
        });
    }

    try {
        const guild = await client.guilds.fetch(guildId);
        let stats = {
            name: guild.name,
            memberCount: guild.memberCount,
            online: 0,
            offline: 0,
            bots: 0,
            channels: guild.channels.cache.size,
            icon: guild.iconURL()
        };

        try {
            // Fetch members with a shorter limit to avoid heavy rate limits
            // Using withPresences: true might still be slow for huge guilds
            const members = await guild.members.fetch({ time: 5000 });
            stats.online = members.filter(m => m.presence?.status === 'online').size;
            stats.offline = members.filter(m => !m.presence || m.presence.status === 'offline').size;
            stats.bots = members.filter(m => m.user.bot).size;
        } catch (fetchError) {
            console.warn(`Could not fetch full member list for ${guildId}: ${fetchError.message}`);
            // If fetch fails, we still have basic stats like memberCount
            stats.online = 'N/A';
            stats.offline = 'N/A';
            stats.bots = 'N/A';
        }

        const memberList = Array.from(guild.members.cache.values()).map(m => ({
            id: m.id,
            displayName: m.displayName || m.user.username,
            avatar: m.user.displayAvatarURL({ size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'
        }));

        // Update Cache
        statsCache.set(guildId, { time: Date.now(), data: { stats, memberList } });

        const guildHelpersData = (db.get('guild_helpers') || {})[guildId] || [];
        const enrichedHelpers = guildHelpersData.map((h, index) => {
            const botClient = botManager.getClient(h.id);
            let botId = null;
            if (botClient && botClient.user) {
                botId = botClient.user.id;
            } else if (h.token) {
                try {
                    const parts = h.token.split('.');
                    if (parts.length > 0) {
                        botId = Buffer.from(parts[0], 'base64').toString('utf-8');
                    }
                } catch (e) {
                    console.error('Failed to parse helper bot token for ID:', e);
                }
            }
            return {
                ...h,
                index: index + 1,
                status: botClient && botClient.ws && botClient.ws.status === 0 ? 'online' : 'offline',
                avatar: botClient && botClient.user ? botClient.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png',
                botId
            };
        });

        const settings = db.get('guild_settings') || {};
        const webhookUrl = settings[guildId]?.webhookUrl || '';
        const blacklist = (db.get('guild_blacklist') || {})[guildId] || [];

        res.render('server', { stats, id, guildId, guildHelpers: enrichedHelpers, webhookUrl, memberList, blacklist, mainBotId: client.user.id, isDemo: false });
    } catch (error) {
        res.status(500).send('Error fetching server details: ' + error.message);
    }
});

const { SmartConsoleLogger, sleep } = require('./utils');

// Broadcast State
const activeBroadcasts = new Set();

// Stop Broadcast Route
router.post('/broadcast/stop', (req, res) => {
    const { id, guildId } = req.body;
    activeBroadcasts.delete(`${id}-${guildId}`);
    res.json({ success: true });
});

// Broadcast Route
router.post('/broadcast', async (req, res) => {
    const { id, guildId, message, type, delay, distMode = 'smart', includeMain } = req.body;
    const masterClient = botManager.getClient(id);
    const io = req.app.get('io');
    const broadcastKey = `${id}-${guildId}`;

    if (!masterClient) return res.json({ success: false, error: 'Bot not running' });
    if (activeBroadcasts.has(broadcastKey)) return res.json({ success: false, error: 'Broadcast already running' });

    try {
        const guild = await masterClient.guilds.fetch(guildId);
        const members = await guild.members.fetch();
        let targetMembers = [];

        switch (type) {
            case 'all': targetMembers = Array.from(members.values()); break;
            case 'online': targetMembers = Array.from(members.filter(m => m.presence?.status === 'online').values()); break;
            case 'offline': targetMembers = Array.from(members.filter(m => !m.presence || m.presence.status === 'offline').values()); break;
            case 'idle': targetMembers = Array.from(members.filter(m => m.presence?.status === 'idle').values()); break;
            case 'dnd': targetMembers = Array.from(members.filter(m => m.presence?.status === 'dnd').values()); break;
            case 'humans': targetMembers = Array.from(members.filter(m => !m.user.bot).values()); break;
            case 'bots': targetMembers = Array.from(members.filter(m => m.user.bot).values()); break;
        }

        // Apply Blacklist Filter
        const blacklist = (db.get('guild_blacklist') || {})[guildId] || [];
        if (blacklist.length > 0) {
            targetMembers = targetMembers.filter(m => !blacklist.includes(m.id));
        }

        if (targetMembers.length === 0) return res.json({ success: false, error: 'No members found for this criteria (or all are blacklisted)' });

        // Get guild-specific active helpers
        const guildHelpersData = (db.get('guild_helpers') || {})[guildId] || [];
        const activeHelpers = [];
        
        for (const h of guildHelpersData) {
            const helperClient = botManager.getClient(h.id);
            if (helperClient && helperClient.ws.status === 0) {
                activeHelpers.push(helperClient);
            }
        }

        // Determine final helper list based on includeMain setting and helper presence
        const helpers = [];
        const mainIncluded = (String(includeMain) === 'true') || activeHelpers.length === 0;
        
        if (mainIncluded) {
            helpers.push(masterClient);
        }
        helpers.push(...activeHelpers);

        activeBroadcasts.add(broadcastKey);
        res.json({ success: true, total: targetMembers.length, helpers: helpers.length });

        // Async parallel broadcast
        (async () => {
            let success = 0;
            let failed = 0;
            let count = 0;
            const total = targetMembers.length;

            const smartLogger = new SmartConsoleLogger();
            smartLogger.start(total);

            // Shuffling helper function for both/random distribution
            const shuffleArray = (array) => {
                const arr = [...array];
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };

            // Prepare sending list per bot based on distribution mode
            const botQueues = helpers.map(() => []);

            if (distMode === 'random') {
                // Randomly assign each member to one of the bots
                for (const member of targetMembers) {
                    const randomBotIndex = Math.floor(Math.random() * helpers.length);
                    botQueues[randomBotIndex].push(member);
                }
            } else if (distMode === 'both') {
                // Shuffle list first, then split contiguously
                const shuffledMembers = shuffleArray(targetMembers);
                const chunkSize = Math.ceil(total / helpers.length);
                for (let i = 0; i < helpers.length; i++) {
                    botQueues[i] = shuffledMembers.slice(i * chunkSize, (i + 1) * chunkSize);
                }
            } else {
                // Default 'smart' mode: Split contiguously
                const chunkSize = Math.ceil(total / helpers.length);
                for (let i = 0; i < helpers.length; i++) {
                    botQueues[i] = targetMembers.slice(i * chunkSize, (i + 1) * chunkSize);
                }
            }

            io.emit('log', { 
                type: 'info', 
                message: `Starting broadcast with ${helpers.length} helper(s) (Main Bot: ${mainIncluded ? 'Included' : 'Excluded'}) under ${distMode.toUpperCase()} mode for ${total} members.` 
            });

            // Launch parallel workers
            const workers = helpers.map(async (bot, index) => {
                const myMembers = botQueues[index];
                for (const member of myMembers) {
                    if (!activeBroadcasts.has(broadcastKey)) return;

                    try {
                        const content = `Hello <@${member.id}>\n${message}`;
                        await member.send(content);
                        success++;
                        io.emit('log', { type: 'success', message: `[Bot: ${bot.user.username}] Sent to ${member.user.tag}` });
                    } catch (e) {
                        failed++;
                        io.emit('log', { type: 'error', message: `[Bot: ${bot.user.username}] Failed for ${member.user.tag}: ${e.message}` });
                    }

                    count++;
                    io.emit('progress', { 
                        current: count, 
                        total: total,
                        success,
                        failed
                    });

                    smartLogger.logProgress(count, success, failed, total);
                    if (delay > 0) await sleep(delay);
                }
            });

            await Promise.all(workers);

            activeBroadcasts.delete(broadcastKey);
            io.emit('log', { type: 'info', message: `Broadcast finished! Total: ${count}, Success: ${success}, Failed: ${failed}` });
            io.emit('finished', { key: broadcastKey });
            smartLogger.stop();
        })();

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Invite System
router.post('/invite/create', (req, res) => {
    const { id, guildId, password, code } = req.body;
    if (!id || !guildId || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
    
    let inviteCode = code && code.trim() !== '' ? code.trim() : Math.random().toString(36).substring(2, 10);
    
    const invites = db.get('invites') || {};
    invites[inviteCode] = { id, guildId, password };
    db.set('invites', invites);
    
    res.json({ success: true, inviteCode });
});

router.get('/invite/:code', (req, res) => {
    const invites = db.get('invites') || {};
    const invite = invites[req.params.code];
    if (!invite) return res.status(404).send('Invite not found or expired.');
    
    res.render('invite', { code: req.params.code, error: null });
});

router.post('/invite/:code', (req, res) => {
    const invites = db.get('invites') || {};
    const invite = invites[req.params.code];
    if (!invite) return res.status(404).send('Invite not found or expired.');
    
    // Device Fingerprint Lock
    const incomingDeviceId = req.body.deviceId;
    if (!incomingDeviceId) {
        return res.render('invite', { code: req.params.code, error: 'Browser identification failed. Please enable JavaScript.' });
    }

    if (invite.deviceId && invite.deviceId !== incomingDeviceId) {
        return res.render('invite', { code: req.params.code, error: 'Access Denied: This invite link has already been used on another device or browser.' });
    }

    if (invite.password === req.body.password) {
        // Lock the invite to this device
        if (!invite.deviceId) {
            invite.deviceId = incomingDeviceId;
            db.set('invites', invites);
        }

        // Set guest cookie for 24 hours
        const accessData = JSON.stringify({ id: invite.id, guildId: invite.guildId });
        res.setHeader('Set-Cookie', `guest_access=${encodeURIComponent(accessData)}; Path=/; Max-Age=86400`);
        res.redirect(`/server/${invite.id}/${invite.guildId}`);
    } else {
        res.render('invite', { code: req.params.code, error: 'Invalid password.' });
    }
});

module.exports = router;
