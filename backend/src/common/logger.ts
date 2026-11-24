/**
 * Minimal console Logger with the same call shape as @nestjs/common's Logger
 * (new Logger(Context.name); logger.log/warn/error/debug/verbose(message)).
 *
 * Live-log upgrade (2026-11-11): every line goes to process.stdout /
 * stderr — the `npm run server` terminal is the live log surface. There is
 * no file transport and nothing is buffered, so `tsx watch` shows each
 * line the moment it is written. Format (one line per event):
 *   [19:52:03] [INFO] [HTTP] GET /api/v1/me 200 12ms
 * Timestamp is the server's local time (IST on this Mac). Level is always
 * shown; ERROR also prints the stack on the following line.
 *
 * Never log secrets through this logger: no tokens, passwords, OTP codes
 * or full request bodies. Masked prefixes (e.g. a phone's first digits)
 * are the most that ever goes in a message.
 */
export class Logger {
  constructor(private readonly context?: string) {}

  private timestamp(): string {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  private print(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: any, ...rest: any[]) {
    const text = message instanceof Error ? message.message : String(message);
    const parts = [`[${this.timestamp()}]`, `[${level}]`];
    if (this.context) parts.push(`[${this.context}]`);
    parts.push(text);
    const line = parts.join(' ');
    if (level === 'ERROR') console.error(line, ...rest);
    else if (level === 'WARN') console.warn(line, ...rest);
    else console.log(line, ...rest);
    if (message instanceof Error && message.stack) {
      console.error(message.stack);
    }
  }

  log(message: any, ...rest: any[]) {
    this.print('INFO', message, ...rest);
  }

  warn(message: any, ...rest: any[]) {
    this.print('WARN', message, ...rest);
  }

  error(message: any, ...rest: any[]) {
    this.print('ERROR', message, ...rest);
  }

  debug(message: any, ...rest: any[]) {
    this.print('DEBUG', message, ...rest);
  }

  verbose(message: any, ...rest: any[]) {
    this.print('INFO', message, ...rest);
  }
}
