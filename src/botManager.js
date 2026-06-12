const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');

class BotManager {
    constructor() {
        this.clients = new Map();
    }

    async startBot(token, guildId, isHelper = false) {
        // Check if bot with this token already exists to avoid duplicates
        const bots = db.get('bots') || {};
        let sessionId = Object.keys(bots).find(id => bots[id].token === token);

        // Also check currently running clients
        let runningEntry = Array.from(this.clients.entries()).find(([id, c]) => c.token === token);
        if (runningEntry) sessionId = runningEntry[0];

        if (!sessionId) {
            sessionId = Math.random().toString(36).substring(2, 10);
        }

        if (this.clients.has(sessionId)) {
            return { client: this.clients.get(sessionId), sessionId };
        }

        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildPresences
            ]
        });

        try {
            await client.login(token);
            client.token = token;
            this.clients.set(sessionId, client);
            
            if (!isHelper) {
                // Save to DB only if it's a main bot
                bots[sessionId] = { 
                    token, 
                    guildId, 
                    status: 'online', 
                    id: sessionId,
                    botName: client.user.username,
                    botAvatar: client.user.displayAvatarURL(),
                    botTag: client.user.tag
                };
                db.set('bots', bots);
            }

            console.log(`Bot started: ${client.user.tag} (ID: ${sessionId})`);
            return { client, sessionId };
        } catch (error) {
            console.error(`Failed to start bot with token:`, error);
            throw error;
        }
    }

    async stopBot(sessionId) {
        const client = this.clients.get(sessionId);
        if (client) {
            client.destroy();
            this.clients.delete(sessionId);

            // Update DB
            const bots = db.get('bots') || {};
            if (bots[sessionId]) {
                bots[sessionId].status = 'offline';
                db.set('bots', bots);
            }
            console.log(`Bot stopped: ${sessionId}`);
        }
    }

    getClient(sessionId) {
        return this.clients.get(sessionId);
    }

    async updateAvatar(sessionId, imagePath) {
        const client = this.clients.get(sessionId);
        if (!client) throw new Error('Bot not running');
        await client.user.setAvatar(imagePath);
        
        // Update DB
        const bots = db.get('bots') || {};
        if (bots[sessionId]) {
            bots[sessionId].botAvatar = client.user.displayAvatarURL();
            db.set('bots', bots);
        }
    }

    async updatePresence(sessionId, { status, type, text }) {
        const client = this.clients.get(sessionId);
        if (!client) throw new Error('Bot not running');
        
        // Map type string to activity type enum
        const activityType = {
            'playing': 0,
            'streaming': 1,
            'listening': 2,
            'watching': 3,
            'competing': 5
        }[type.toLowerCase()] || 0;

        client.user.setPresence({
            status: status,
            activities: [{
                name: text,
                type: activityType
            }]
        });

        // Update DB
        const bots = db.get('bots') || {};
        if (bots[sessionId]) {
            bots[sessionId].presence = { status, type, text };
            db.set('bots', bots);
        }
    }

    getAllClients() {
        return Array.from(this.clients.values());
    }
}

module.exports = new BotManager();
