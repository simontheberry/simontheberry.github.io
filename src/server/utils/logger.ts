// ============================================================================
// Structured Logger
// ============================================================================

import winston from 'winston';
import { config } from '../config';
import { maskPii, maskObjectPii } from './pii-detector';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format that masks PII from log metadata
const piiMasking = winston.format((info) => {
  if (config.NODE_ENV === 'production' || config.NODE_ENV === 'test') {
    if (typeof info.message === 'string') {
      info.message = maskPii(info.message);
    }
    // Mask PII in metadata fields (skip standard winston fields)
    const skipKeys = new Set(['level', 'message', 'timestamp', 'service', 'stack']);
    for (const key of Object.keys(info)) {
      if (!skipKeys.has(key) && info[key] !== undefined) {
        info[key] = maskObjectPii(info[key]);
      }
    }
  }
  return info;
});

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
      piiMasking(),
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
