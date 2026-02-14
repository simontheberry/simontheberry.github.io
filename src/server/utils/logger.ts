// ============================================================================
// Structured Logger
// ============================================================================

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

export function createLogger(service: string) {
  return winston.createLogger({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    defaultMeta: { service },
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat,
    ),
    transports: [
      new winston.transports.Console({
        format: combine(
          colorize(),
          logFormat,
        ),
      }),
    ],
  });
}
