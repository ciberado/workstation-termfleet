import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { startHealthCheckScheduler } from './jobs/scheduler.js';

// Initialize database (imports will run initializeDatabase)
import './db/index.js';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom middleware
  app.use(requestId);
  app.use(requestLogger);
  app.use(rateLimiter);

  // Mount API routes
  app.use('/api', routes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
export function startServer(): void {
  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`Termfleet server started`, {
      port: config.port,
      nodeEnv: config.nodeEnv,
      baseDomain: config.baseDomain,
    });

    // Start health check scheduler
    startHealthCheckScheduler();
  });
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
