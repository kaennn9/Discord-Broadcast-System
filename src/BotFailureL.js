const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger'); // أو أي نظام تسجيل تستخدمه

/**
 * BotFailureLogger - Tracks critical bot failures (not DM blocks)
 * Logs important failures like:
 * - Bot flagged by Discord
 * - Bot banned
 * - Bot token invalid
 * - Bot rate limited severely
 * - Bot lost guild access
 * 
 * Does NOT log:
 * - User DMs closed
 * - User blocks bot
 * - Missing permissions for individual users
 */
class BotFailureLogger {
    constructor(options = {}) {
        this.logFile = options.logFile || path.join(process.cwd(), 'bot_failures.json');
        this.backupDir = options.backupDir || path.join(process.cwd(), 'backups');
        this.maxLogEntries = options.maxLogEntries || 1000;
        this.retentionDays = options.retentionDays || 30;
        this.failureCache = new Map();
        this._writeChain = Promise.resolve();
        this.alertCallbacks = [];
        
        // Ensure directories exist
        this._initDirectories();
    }

    async _initDirectories() {
        try {
            const dir = path.dirname(this.logFile);
            await fs.mkdir(dir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create directories:', error.message);
        }
    }

    // Load existing failures from disk
    async loadFailures() {
        try {
            const data = await fs.readFile(this.logFile, 'utf8');
            const failures = JSON.parse(data);
            
            // Clean up old entries
            const cutoffDate = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
            const recentFailures = failures.filter(f => f.timestamp > cutoffDate);
            
            // Limit total entries
            const limitedFailures = recentFailures.slice(-this.maxLogEntries);
            
            if (limitedFailures.length !== failures.length) {
                logger.info(`Cleaned up ${failures.length - limitedFailures.length} old failure entries`);
                await this.saveFailures(limitedFailures);
            }
            
            return limitedFailures;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            logger.error('Error loading bot failures:', error.message);
            return [];
        }
    }

    // Save failures to disk with backup
    async saveFailures(failures) {
        this._writeChain = this._writeChain.then(async () => {
            try {
                const payload = JSON.stringify(failures, null, 2);
                
                // Create backup of existing file if it exists
                try {
                    const oldData = await fs.readFile(this.logFile, 'utf8');
                    const backupFile = path.join(this.backupDir, `bot_failures_${Date.now()}.json`);
                    await fs.writeFile(backupFile, oldData);
                    
                    // Clean old backups (keep last 5)
                    await this._cleanOldBackups();
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        logger.error('Failed to create backup:', error.message);
                    }
                }
                
                const tmpFile = `${this.logFile}.tmp`;
                await fs.writeFile(tmpFile, payload);
                await fs.rename(tmpFile, this.logFile);
            } catch (error) {
                logger.error('Error saving bot failures:', error.message);
            }
        });
        return this._writeChain;
    }

    async _cleanOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files.filter(f => f.startsWith('bot_failures_') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            // Keep only last 5 backups
            const toDelete = backupFiles.slice(5);
            for (const file of toDelete) {
                await fs.unlink(path.join(this.backupDir, file));
            }
        } catch (error) {
            logger.error('Failed to clean old backups:', error.message);
        }
    }

    // Check if error is a critical bot failure (not user-related)
    isCriticalBotFailure(error, context = {}) {
        if (!error) return { isCritical: false };

        const errorCode = error.code;
        const errorMessage = (error.message || '').toLowerCase();
        const statusCode = error.status || error.statusCode || context.statusCode;

        // Expanded critical Discord API errors
        const criticalCodes = {
            // Gateway close codes
            4000: 'Unknown Gateway Error',
            4001: 'Invalid Gateway Opcode',
            4002: 'Invalid Gateway Payload',
            4003: 'Not Authenticated - Session Invalidated',
            4004: 'Authentication Failed - Invalid Token',
            4005: 'Already Authenticated - Duplicate Identify',
            4007: 'Invalid Sequence for Resume',
            4008: 'Rate Limited - Too Many Payloads',
            4009: 'Session Timed Out',
            4010: 'Invalid Shard Configuration',
            4011: 'Sharding Required - Too Many Guilds',
            4012: 'Invalid API Version',
            4013: 'Invalid Gateway Intents',
            4014: 'Disallowed Gateway Intents',
            
            // HTTP & JSON errors
            40001: 'Unauthorized - Invalid Bot Token',
            40002: 'Account Verification Required',
            40003: 'Account Disabled/Banned',
            50001: 'Missing Access - Bot Removed/Banned',
            50013: 'Missing Permissions - Critical Permissions Lost',
            50014: 'Invalid Authentication Token',
            20028: 'Severe Rate Limit - Channel',
            20029: 'Severe Rate Limit - Guild',
            40007: 'Banned from Guild',
            10004: 'Guild Not Found - Bot Removed',
            90001: 'Bot Reaction Blocked - Action Restricted',
            60003: 'Two-Factor Required - Bot Locked',
            
            // RPC errors
            4000: 'RPC Unknown Error',
            4006: 'RPC Invalid Permissions',
            4009: 'RPC Invalid Token',
        };

        if (criticalCodes[errorCode]) {
            return {
                isCritical: true,
                reason: criticalCodes[errorCode],
                code: errorCode,
                severity: this._getSeverity(errorCode)
            };
        }

        // Check for token-related issues
        if (errorMessage.includes('token') && 
            (errorMessage.includes('invalid') || errorMessage.includes('unauthorized'))) {
            return {
                isCritical: true,
                reason: 'Invalid Bot Token',
                code: 'TOKEN_ERROR',
                severity: 'high'
            };
        }

        // Check for bot flagged/banned
        if (errorMessage.includes('flagged') || 
            errorMessage.includes('your bot has been banned') ||
            errorMessage.includes('account disabled') ||
            errorMessage.includes('terminated')) {
            return {
                isCritical: true,
                reason: 'Bot Account Flagged/Banned by Discord',
                code: 'BOT_BANNED',
                severity: 'critical'
            };
        }

        // Check for severe rate limiting
        const retryAfter = context.retryAfter || error.retryAfter;
        if ((errorCode === 429 || statusCode === 429) && retryAfter && retryAfter > 3600000) {
            return {
                isCritical: true,
                reason: `Severe Rate Limit (>1 hour) - Retry after ${Math.round(retryAfter / 1000)}s`,
                code: 'SEVERE_RATE_LIMIT',
                severity: 'high',
                retryAfter
            };
        }

        // Check for CloudFlare bans
        if (errorMessage.includes('cloudflare') || 
            errorMessage.includes('cf-ray') ||
            (statusCode === 403 && context.cfRay)) {
            return {
                isCritical: true,
                reason: 'CloudFlare Protection Triggered - Bot Temporarily Blocked',
                code: 'CLOUDFLARE_BAN',
                severity: 'medium'
            };
        }

        // Check for connection issues
        if (error.code === 'ECONNREFUSED' || 
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND') {
            return {
                isCritical: true,
                reason: 'Discord API Connection Failed',
                code: 'CONNECTION_ERROR',
                severity: 'medium'
            };
        }

        // Check for shard issues
        if (errorMessage.includes('shard') && 
            (errorMessage.includes('death') || errorMessage.includes('dead') || errorMessage.includes('kill'))) {
            return {
                isCritical: true,
                reason: 'Bot Shard Died - Connection Lost',
                code: 'SHARD_DEATH',
                severity: 'high'
            };
        }

        // NOT critical errors (user-related):
        // 50007 - Cannot send DM to user
        // 10013 - Unknown user
        // 10003 - Unknown channel
        // Regular rate limits (<1 hour)
        
        return { isCritical: false };
    }

    _getSeverity(errorCode) {
        const highSeverity = [40001, 40002, 40003, 40004, 50001, 4011, 4014, 4004];
        const criticalSeverity = [40003, 'BOT_BANNED', 'TOKEN_ERROR'];
        
        if (criticalSeverity.includes(errorCode)) return 'critical';
        if (highSeverity.includes(errorCode)) return 'high';
        return 'medium';
    }

    // Log a critical bot failure
    async logFailure(botInfo, error, context = {}) {
        try {
            const criticalCheck = this.isCriticalBotFailure(error, context);
            
            if (!criticalCheck.isCritical) {
                return { logged: false, reason: 'not_critical' };
            }

            const failureEntry = {
                id: this._generateId(),
                timestamp: Date.now(),
                timestampISO: new Date().toISOString(),
                botId: botInfo.id || 'unknown',
                botTag: botInfo.tag || botInfo.username || 'unknown',
                botToken: botInfo.token ? `${botInfo.token.substring(0, 20)}...${botInfo.token.substring(botInfo.token.length - 10)}` : 'unknown',
                reason: criticalCheck.reason,
                errorCode: criticalCheck.code,
                errorMessage: error.message || error.toString() || 'Unknown error',
                severity: criticalCheck.severity,
                stackTrace: error.stack,
                context: {
                    guildId: context.guildId,
                    channelId: context.channelId,
                    userId: context.userId,
                    operation: context.operation || 'unknown',
                    endpoint: context.endpoint,
                    statusCode: context.statusCode || error.status || error.statusCode,
                    retryAfter: criticalCheck.retryAfter || context.retryAfter,
                    additionalInfo: context.additionalInfo
                },
                resolved: false,
                resolutionNotes: null
            };

            // Prevent duplicate logging
            const cacheKey = `${failureEntry.botId}-${failureEntry.errorCode}`;
            const lastLogged = this.failureCache.get(cacheKey);
            
            if (lastLogged && Date.now() - lastLogged < 60000) {
                return { logged: false, reason: 'duplicate', lastLogged: new Date(lastLogged) };
            }
            
            this.failureCache.set(cacheKey, Date.now());

            // Clean cache older than 1 hour
            this._cleanCache();

            // Load existing failures, add new one, and save
            const failures = await this.loadFailures();
            failures.push(failureEntry);
            await this.saveFailures(failures);

            // Log to console with high visibility
            this._logFailureToConsole(failureEntry);
            
            // Trigger alert callbacks
            await this._triggerAlerts(failureEntry);

            // Send to monitoring service (optional)
            await this._sendToMonitoring(failureEntry);

            return { logged: true, entry: failureEntry };

        } catch (error) {
            logger.error('Failed to log bot failure:', error.message);
            return { logged: false, reason: 'error', error: error.message };
        }
    }

    _generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    _cleanCache() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [key, timestamp] of this.failureCache.entries()) {
            if (timestamp < oneHourAgo) {
                this.failureCache.delete(key);
            }
        }
    }

    _logFailureToConsole(failureEntry) {
        const severityColors = {
            critical: '\x1b[41m\x1b[1m', // Red background
            high: '\x1b[31m\x1b[1m',     // Red text
            medium: '\x1b[33m\x1b[1m'    // Yellow text
        };
        
        const color = severityColors[failureEntry.severity] || '\x1b[31m';
        const reset = '\x1b[0m';
        
        console.log('\n' + '━'.repeat(80));
        console.log(`${color}🚨 CRITICAL BOT FAILURE DETECTED 🚨${reset}`);
        console.log(`${color}Time:${reset} ${failureEntry.timestampISO}`);
        console.log(`${color}Bot:${reset} ${failureEntry.botTag} (${failureEntry.botId})`);
        console.log(`${color}Severity:${reset} ${failureEntry.severity.toUpperCase()}`);
        console.log(`${color}Reason:${reset} ${failureEntry.reason}`);
        console.log(`${color}Error Code:${reset} ${failureEntry.errorCode}`);
        console.log(`${color}Message:${reset} ${failureEntry.errorMessage}`);
        
        if (failureEntry.context.operation) {
            console.log(`${color}Operation:${reset} ${failureEntry.context.operation}`);
        }
        if (failureEntry.context.endpoint) {
            console.log(`${color}Endpoint:${reset} ${failureEntry.context.endpoint}`);
        }
        
        console.log(`${color}Saved to:${reset} ${this.logFile}`);
        console.log('━'.repeat(80) + '\n');
    }

    async _triggerAlerts(failureEntry) {
        for (const callback of this.alertCallbacks) {
            try {
                await callback(failureEntry);
            } catch (error) {
                logger.error('Alert callback failed:', error.message);
            }
        }
    }

    async _sendToMonitoring(failureEntry) {
        // يمكن إضافة Webhook, Discord webhook, Slack, Email, etc.
        if (process.env.FAILURE_WEBHOOK_URL) {
            try {
                const axios = require('axios');
                await axios.post(process.env.FAILURE_WEBHOOK_URL, {
                    embeds: [{
                        title: '🚨 Bot Failure Detected',
                        color: 0xFF0000,
                        fields: [
                            { name: 'Bot', value: failureEntry.botTag, inline: true },
                            { name: 'Severity', value: failureEntry.severity, inline: true },
                            { name: 'Reason', value: failureEntry.reason, inline: false },
                            { name: 'Error Code', value: failureEntry.errorCode, inline: true },
                            { name: 'Time', value: failureEntry.timestampISO, inline: true }
                        ],
                        timestamp: failureEntry.timestampISO
                    }]
                });
            } catch (error) {
                logger.error('Failed to send to webhook:', error.message);
            }
        }
    }

    // Get failure statistics
    async getFailureStats(botId = null) {
        const failures = await this.loadFailures();
        const filteredFailures = botId ? failures.filter(f => f.botId === botId) : failures;
        
        const stats = {
            totalFailures: filteredFailures.length,
            unresolvedFailures: filteredFailures.filter(f => !f.resolved).length,
            failuresByBot: {},
            failuresByReason: {},
            failuresBySeverity: {
                critical: 0,
                high: 0,
                medium: 0
            },
            failuresByHour: {},
            failuresByDay: {},
            recentFailures: filteredFailures.slice(-10).reverse(),
            averageTimeBetweenFailures: null
        };

        filteredFailures.forEach(failure => {
            // Count by bot
            if (!stats.failuresByBot[failure.botTag]) {
                stats.failuresByBot[failure.botTag] = 0;
            }
            stats.failuresByBot[failure.botTag]++;

            // Count by reason
            if (!stats.failuresByReason[failure.reason]) {
                stats.failuresByReason[failure.reason] = 0;
            }
            stats.failuresByReason[failure.reason]++;

            // Count by severity
            if (stats.failuresBySeverity[failure.severity] !== undefined) {
                stats.failuresBySeverity[failure.severity]++;
            }

            // Group by hour
            const hour = new Date(failure.timestamp).toISOString().slice(0, 13);
            stats.failuresByHour[hour] = (stats.failuresByHour[hour] || 0) + 1;

            // Group by day
            const day = new Date(failure.timestamp).toISOString().slice(0, 10);
            stats.failuresByDay[day] = (stats.failuresByDay[day] || 0) + 1;
        });

        // Calculate average time between failures
        if (filteredFailures.length > 1) {
            let totalGap = 0;
            for (let i = 1; i < filteredFailures.length; i++) {
                totalGap += filteredFailures[i].timestamp - filteredFailures[i-1].timestamp;
            }
            stats.averageTimeBetweenFailures = totalGap / (filteredFailures.length - 1);
        }

        return stats;
    }

    // Check if a bot has recent critical failures
    async isBotHealthy(botId, timeframeMinutes = 60) {
        const failures = await this.loadFailures();
        
        const timeframe = timeframeMinutes * 60 * 1000;
        const cutoffTime = Date.now() - timeframe;
        const recentFailures = failures.filter(f => 
            f.botId === botId && f.timestamp > cutoffTime && !f.resolved
        );

        const severeFailures = recentFailures.filter(f => f.severity === 'critical' || f.severity === 'high');

        return {
            healthy: recentFailures.length === 0,
            recentFailureCount: recentFailures.length,
            severeFailureCount: severeFailures.length,
            failures: recentFailures,
            recommendation: this._getHealthRecommendation(recentFailures)
        };
    }

    _getHealthRecommendation(failures) {
        if (failures.length === 0) return 'Bot is healthy';
        
        const criticalCount = failures.filter(f => f.severity === 'critical').length;
        if (criticalCount > 0) return 'URGENT: Bot has critical failures - Investigate immediately';
        
        const highCount = failures.filter(f => f.severity === 'high').length;
        if (highCount > 2) return 'Warning: Multiple high-severity failures - Monitor closely';
        
        return 'Attention: Bot has failures - Review and take action';
    }

    // Mark a failure as resolved
    async markResolved(failureId, resolutionNotes = null) {
        const failures = await this.loadFailures();
        const failureIndex = failures.findIndex(f => f.id === failureId);
        
        if (failureIndex === -1) return false;
        
        failures[failureIndex].resolved = true;
        failures[failureIndex].resolutionNotes = resolutionNotes;
        failures[failureIndex].resolvedAt = Date.now();
        failures[failureIndex].resolvedAtISO = new Date().toISOString();
        
        await this.saveFailures(failures);
        return true;
    }

    // Get detailed failure report
    async getFailureReport(botId = null, days = 7) {
        const failures = await this.loadFailures();
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filteredFailures = (botId ? failures.filter(f => f.botId === botId) : failures)
            .filter(f => f.timestamp > cutoff);
        
        const report = {
            period: `${days} days`,
            generated: new Date().toISOString(),
            totalFailures: filteredFailures.length,
            uniqueErrors: [...new Set(filteredFailures.map(f => f.errorCode))],
            mostCommonError: null,
            worstBot: null,
            failureRate: null,
            details: filteredFailures
        };
        
        if (filteredFailures.length > 0) {
            // Most common error
            const errorCounts = {};
            filteredFailures.forEach(f => {
                errorCounts[f.errorCode] = (errorCounts[f.errorCode] || 0) + 1;
            });
            report.mostCommonError = Object.entries(errorCounts).sort((a,b) => b[1] - a[1])[0];
            
            // Bot with most failures
            const botCounts = {};
            filteredFailures.forEach(f => {
                botCounts[f.botTag] = (botCounts[f.botTag] || 0) + 1;
            });
            report.worstBot = Object.entries(botCounts).sort((a,b) => b[1] - a[1])[0];
            
            // Failure rate per day
            report.failureRate = (filteredFailures.length / days).toFixed(2);
        }
        
        return report;
    }

    // Add alert callback
    onFailure(callback) {
        if (typeof callback === 'function') {
            this.alertCallbacks.push(callback);
        }
    }

    // Clear all logged failures
    async clearFailures(botId = null) {
        try {
            if (botId) {
                const failures = await this.loadFailures();
                const remainingFailures = failures.filter(f => f.botId !== botId);
                await this.saveFailures(remainingFailures);
                logger.info(`Cleared failures for bot ${botId}`);
            } else {
                await fs.unlink(this.logFile);
                this.failureCache.clear();
                logger.info('All bot failures cleared');
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Failed to clear bot failure log:', error.message);
                throw error;
            }
        }
    }

    // Export failures to CSV
    async exportToCSV(botId = null) {
        const failures = await this.loadFailures();
        const filteredFailures = botId ? failures.filter(f => f.botId === botId) : failures;
        
        if (filteredFailures.length === 0) return null;
        
        const headers = ['ID', 'Timestamp', 'Bot ID', 'Bot Tag', 'Reason', 'Error Code', 'Severity', 'Resolved'];
        const csvRows = [headers];
        
        for (const failure of filteredFailures) {
            csvRows.push([
                failure.id,
                failure.timestampISO,
                failure.botId,
                failure.botTag,
                `"${failure.reason}"`,
                failure.errorCode,
                failure.severity,
                failure.resolved
            ]);
        }
        
        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const outputPath = path.join(process.cwd(), `failure_export_${Date.now()}.csv`);
        await fs.writeFile(outputPath, csvContent);
        
        return outputPath;
    }
}

// Export the class
module.exports = BotFailureLogger;

// Example usage
if (require.main === module) {
    (async () => {
        const logger = new BotFailureLogger();
        
        // Example failure logging
        await logger.logFailure(
            { id: '123456789', tag: 'TestBot#1234', token: process.env.TOKEN },
            { message: 'Invalid token', code: 40001, status: 401 },
            { operation: 'guild_fetch', endpoint: '/guilds/@me' }
        );
        
        // Get stats
        const stats = await logger.getFailureStats();
        console.log('Failure Stats:', JSON.stringify(stats, null, 2));
        
        // Check bot health
        const health = await logger.isBotHealthy('123456789');
        console.log('Bot Health:', health);
    })();
}