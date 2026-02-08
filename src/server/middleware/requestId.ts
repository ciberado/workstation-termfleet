import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware to add unique request ID to each request
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}
