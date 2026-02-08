import winston from 'winston';
import { config } from './config.js';
import path from 'path';
import fs from 'fs';

// Ensure log directory exists
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define custom log levels for console (with colors)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports: [
    // Console output (INFO level)
    new winston.transports.Console({
      level: 'info',
      format: consoleFormat,
    }),
    // File output - all logs (DEBUG+)
    new winston.transports.File({
      filename: path.join(config.logDir, 'combined.log'),
      level: 'debug',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(config.logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add request logging helper
export function logRequest(method: string, path: string, statusCode: number, duration: number) {
  logger.debug('HTTP Request', {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
  });
}

export default logger;
