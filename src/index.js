const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');
const botManager = require('./botManager');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Socket.io sharing
app.set('io', io);

// Routes
const mainRoutes = require('./routes');
app.use('/', mainRoutes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-start bots from DB
    const bots = db.get('bots') || {};
    for (const id in bots) {
        const bot = bots[id];
        if (bot.status === 'online') {
            try {
                await botManager.startBot(bot.token, bot.guildId);
            } catch (e) {
                console.error(`Could not auto-start bot: ${bot.token}`);
            }
        }
    }

    // Auto-start helper bots from DB
    const guildHelpers = db.get('guild_helpers') || {};
    for (const guildId in guildHelpers) {
        const helpers = guildHelpers[guildId] || [];
        for (const helper of helpers) {
            try {
                await botManager.startBot(helper.token, guildId, true);
                console.log(`Auto-started helper bot: ${helper.botName}`);
            } catch (e) {
                console.error(`Could not auto-start helper bot ${helper.botName || helper.id}: ${e.message}`);
            }
        }
    }
});
