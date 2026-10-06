import type { GameLogger } from '@games/shared';

export interface LoggerOptions {
  prefix?: string;
  /** 生产环境只保留 warn/error */
  silentDebug?: boolean;
}

export function createLogger(options: LoggerOptions = {}): GameLogger {
  const prefix = options.prefix ?? '[game]';
  const silentDebug = options.silentDebug ?? false;
  const wrap =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, ...args: unknown[]): void => {
      if (level === 'debug' && silentDebug) return;
      // eslint-disable-next-line no-console
      (console[level] ?? console.log)(`${prefix} ${message}`, ...args);
    };

  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
  };
}
