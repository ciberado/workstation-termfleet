import { config } from '../config.js';
import { logger } from '../logger.js';
import { runHealthCheckJob } from './healthCheck.js';

/**
 * Initialize and start the health check scheduler
 */
export function startHealthCheckScheduler(): void {
  const intervalSeconds = Math.floor(config.workstationCheckInterval / 1000);

  logger.info('Starting health check scheduler', {
    interval: `${intervalSeconds}s`,
  });

  // Run immediately on start
  runHealthCheckJob().catch((error) => {
    logger.error('Initial health check job failed', { error });
  });

  // Schedule to run every N seconds
  // Convert milliseconds to cron expression
  // For simplicity, use setInterval for sub-minute intervals
  setInterval(() => {
    runHealthCheckJob().catch((error) => {
      logger.error('Scheduled health check job failed', { error });
    });
  }, config.workstationCheckInterval);

  logger.info('Health check scheduler started successfully');
}
