/**
 * Simple logger utility for the SDK
 */

export enum LogLevel {
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

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private output: (message: string) => void;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? 'ZitiMCP';
    this.output = options.output ?? console.error.bind(console);
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${this.prefix}] [${level}] ${message}${formattedArgs}`;
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      this.output(this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      this.output(this.formatMessage('WARN', message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      this.output(this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      this.output(this.formatMessage('DEBUG', message, ...args));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: `${this.prefix}:${prefix}`,
      output: this.output
    });
  }
}

export const defaultLogger = new Logger();

export default Logger;
