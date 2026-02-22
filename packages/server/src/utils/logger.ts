type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const colors = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function formatMessage(level: LogLevel, message: string, meta?: object): string {
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${colors.debug}[${timestamp}]${colors.reset} ${color}${level.toUpperCase()}${colors.reset}: ${message}${metaStr}`;
}

export const logger = {
  info: (message: string, meta?: object) => console.log(formatMessage('info', message, meta)),
  warn: (message: string, meta?: object) => console.warn(formatMessage('warn', message, meta)),
  error: (message: string, meta?: object) => console.error(formatMessage('error', message, meta)),
  debug: (message: string, meta?: object) => {
    if (process.env.DEBUG) {
      console.log(formatMessage('debug', message, meta));
    }
  },
};
