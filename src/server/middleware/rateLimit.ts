import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { ErrorCode } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Rate limiting middleware
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMaxRequests,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
    });
  },
});
