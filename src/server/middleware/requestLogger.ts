import { Request, Response, NextFunction } from 'express';
import { logRequest } from '../logger.js';

/**
 * Middleware to log HTTP requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logRequest(req.method, req.path, res.statusCode, duration);
  });

  next();
}
