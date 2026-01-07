/**
 * Simple logger utility for the SDK
 */
export declare enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}
export interface LoggerOptions {
    level: LogLevel;
    prefix?: string;
    output?: (message: string) => void;
}
export declare class Logger {
    private level;
    private prefix;
    private output;
    constructor(options?: Partial<LoggerOptions>);
    private formatMessage;
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    setLevel(level: LogLevel): void;
    child(prefix: string): Logger;
}
export declare const defaultLogger: Logger;
export default Logger;
//# sourceMappingURL=Logger.d.ts.map