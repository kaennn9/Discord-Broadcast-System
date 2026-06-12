const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createLogger = (context) => {
    const getTimestamp = () => {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    };
    
    const formatMessage = (message) => {
        return `[${getTimestamp()}] [${context}] ${message}`;
    };
    
    return {
        info: (message, ...args) => {
            console.log('\x1b[32m%s\x1b[0m', formatMessage(message), ...args);
        },
        warn: (message, ...args) => {
            console.log('\x1b[33m%s\x1b[0m', formatMessage(message), ...args);
        },
        error: (message, ...args) => {
            console.error('\x1b[31m%s\x1b[0m', formatMessage(message), ...args);
        },
        debug: (message, ...args) => {
            const DEBUG_MODE = false;
            if (DEBUG_MODE) {
                console.log('\x1b[36m%s\x1b[0m', formatMessage(message), ...args);
            }
        }
    };
};

const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
};

const createProgressBar = (percent, size = 10) => {
    const filledCount = Math.floor((percent / 100) * size);
    return '█'.repeat(filledCount) + '░'.repeat(size - filledCount);
};

const formatTime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
};

// Advanced time estimation class with stable moving average
class SmartTimeEstimator {
    constructor() {
        this.startTime = null;
        this.totalMembers = 0;
    }

    start(totalMembers) {
        this.startTime = Date.now();
        this.totalMembers = totalMembers;
    }

    getStats(processedCount, totalMembers) {
        const now = Date.now();
        const elapsedTime = this.startTime ? now - this.startTime : 0;
        
        const percentage = totalMembers > 0 ? Math.floor((processedCount / totalMembers) * 100) : 0;
        
        // Simple, stable calculation: use overall average speed
        let remainingTime = null;
        let etaTimestamp = null;
        
        if (processedCount > 50) { // Wait for at least 50 members for accurate estimation
            const avgTimePerMember = elapsedTime / processedCount;
            const remainingCount = totalMembers - processedCount;
            remainingTime = Math.round(avgTimePerMember * remainingCount);
            etaTimestamp = new Date(now + remainingTime);
        }
        
        const currentSpeed = processedCount > 0 && elapsedTime > 0 
            ? (processedCount / (elapsedTime / 1000)).toFixed(2)
            : '0.00';
        
        return {
            percentage,
            elapsedTime,
            remainingTime,
            etaTimestamp,
            currentSpeed,
            processedCount,
            totalMembers
        };
    }
}

const displayFormattedCounter = (current, total) => {
    // This function is deprecated - console updates are now handled by SmartConsoleLogger
    // Kept for backward compatibility
};

// Smart console logger that updates every 6 seconds
class SmartConsoleLogger {
    constructor(updateInterval = 6000) {
        this.updateInterval = updateInterval;
        this.lastUpdate = 0;
        this.timeEstimator = new SmartTimeEstimator();
        this.shouldUpdate = true;
    }

    start(totalMembers) {
        this.timeEstimator.start(totalMembers);
        this.lastUpdate = 0;
        this.shouldUpdate = true;
    }

    logProgress(processedCount, successCount, failureCount, totalMembers) {
        const now = Date.now();
        
        // Only update console every 6 seconds OR on first/last message
        if (processedCount === 1 || 
            processedCount === totalMembers || 
            now - this.lastUpdate >= this.updateInterval) {
            
            this.lastUpdate = now;
            
            const stats = this.timeEstimator.getStats(processedCount, totalMembers);
            
            // Clear console and display smart update
            console.log('\n' + '═'.repeat(80));
            console.log('\x1b[36m%s\x1b[0m', '🚀 BROADCAST PROGRESS - Smart Update System');
            console.log('═'.repeat(80));
            
            // Progress bar
            const barLength = 40;
            const filled = Math.floor((stats.percentage / 100) * barLength);
            const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            console.log('\x1b[32m%s\x1b[0m', `Progress: [${progressBar}] ${stats.percentage}%`);
            
            // Status
            console.log('\x1b[33m%s\x1b[0m', `📊 Processed: ${processedCount}/${totalMembers} members`);
            console.log('\x1b[32m%s\x1b[0m', `✅ Success: ${successCount}`);
            console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${failureCount}`);
            
            // Time information
            console.log('\n' + '─'.repeat(80));
            console.log('\x1b[36m%s\x1b[0m', '⏱️  TIME ANALYSIS - Advanced Estimation System');
            console.log('─'.repeat(80));
            
            const elapsedMin = Math.floor(stats.elapsedTime / 60000);
            const elapsedSec = Math.floor((stats.elapsedTime % 60000) / 1000);
            console.log(`⏰ Elapsed Time: ${elapsedMin}m ${elapsedSec}s`);
            
            if (stats.remainingTime !== null) {
                const remMin = Math.floor(stats.remainingTime / 60000);
                const remSec = Math.floor((stats.remainingTime % 60000) / 1000);
                const remHours = Math.floor(remMin / 60);
                const remMinDisplay = remMin % 60;
                
                if (remHours > 0) {
                    console.log(`⏳ Time Remaining: ${remHours}h ${remMinDisplay}m ${remSec}s`);
                } else {
                    console.log(`⏳ Time Remaining: ${remMin}m ${remSec}s`);
                }
            } else {
                console.log('⏳ Time Remaining: Calculating... (need 50+ members processed)');
            }
            
            const totalEstimated = stats.elapsedTime + (stats.remainingTime || 0);
            const totalMin = Math.floor(totalEstimated / 60000);
            const totalSec = Math.floor((totalEstimated % 60000) / 1000);
            const totalHours = Math.floor(totalMin / 60);
            const totalMinDisplay = totalMin % 60;
            
            if (totalHours > 0) {
                console.log(`📅 Total Time: ${totalHours}h ${totalMinDisplay}m ${totalSec}s (estimated)`);
            } else {
                console.log(`📅 Total Time: ${totalMin}m ${totalSec}s (estimated)`);
            }
            
            if (stats.etaTimestamp) {
                const etaFormatted = stats.etaTimestamp.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                console.log('\x1b[35m%s\x1b[0m', `🎯 Will Finish At: ${etaFormatted}`);
            }
            
            console.log(`⚡ Current Speed: ${stats.currentSpeed} members/sec`);
            
            console.log('═'.repeat(80) + '\n');
        }
    }

    stop() {
        this.shouldUpdate = false;
    }
}

module.exports = {
    sleep,
    createLogger,
    formatNumber,
    generateId,
    createProgressBar,
    formatTime,
    displayFormattedCounter,
    SmartConsoleLogger,
    SmartTimeEstimator
};
