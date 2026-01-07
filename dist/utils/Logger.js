/**
 * Simple logger utility for the SDK
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["NONE"] = 0] = "NONE";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["INFO"] = 3] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
})(LogLevel || (LogLevel = {}));
export class Logger {
    level;
    prefix;
    output;
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.prefix = options.prefix ?? 'ZitiMCP';
        this.output = options.output ?? console.error.bind(console);
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
        return `[${timestamp}] [${this.prefix}] [${level}] ${message}${formattedArgs}`;
    }
    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            this.output(this.formatMessage('ERROR', message, ...args));
        }
    }
    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            this.output(this.formatMessage('WARN', message, ...args));
        }
    }
    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            this.output(this.formatMessage('INFO', message, ...args));
        }
    }
    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            this.output(this.formatMessage('DEBUG', message, ...args));
        }
    }
    setLevel(level) {
        this.level = level;
    }
    child(prefix) {
        return new Logger({
            level: this.level,
            prefix: `${this.prefix}:${prefix}`,
            output: this.output
        });
    }
}
export const defaultLogger = new Logger();
export default Logger;
//# sourceMappingURL=Logger.js.map