import dotenv from 'dotenv';
import { Config } from '../shared/types.js';

// Load environment variables
dotenv.config();

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const config: Config = {
    port: parseInt(process.env.TERMFLEET_PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    baseDomain: process.env.TERMFLEET_BASE_DOMAIN || '',
    workstationCheckInterval: parseInt(
      process.env.TERMFLEET_WORKSTATION_CHECK_INTERVAL || '20000',
      10
    ),
    healthCheckTimeout: parseInt(process.env.TERMFLEET_HEALTH_CHECK_TIMEOUT || '10000', 10),
    spaceshipApiKey: process.env.TERMFLEET_SPACESHIP_API_KEY || '',
    spaceshipApiSecret: process.env.TERMFLEET_SPACESHIP_API_SECRET || '',
    logLevel: process.env.TERMFLEET_LOG_LEVEL || 'debug',
    logDir: process.env.TERMFLEET_LOG_DIR || './logs',
    dbPath: process.env.TERMFLEET_DB_PATH || './data/termfleet.db',
    rateLimitWindow: parseInt(process.env.TERMFLEET_RATE_LIMIT_WINDOW || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.TERMFLEET_RATE_LIMIT_MAX_REQUESTS || '100', 10),
    dnsTtl: parseInt(process.env.TERMFLEET_DNS_TTL || '600', 10),
  };

  // Validate required fields
  const errors: string[] = [];

  if (!config.baseDomain) {
    errors.push('TERMFLEET_BASE_DOMAIN is required');
  }

  if (!config.spaceshipApiKey && config.nodeEnv === 'production') {
    errors.push('TERMFLEET_SPACESHIP_API_KEY is required in production');
  }

  if (!config.spaceshipApiSecret && config.nodeEnv === 'production') {
    errors.push('TERMFLEET_SPACESHIP_API_SECRET is required in production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return config;
}

export const config = loadConfig();
