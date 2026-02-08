import { Response } from 'express';
import { ApiResponse, ErrorCode } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Send standardized success response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * Send standardized error response
 */
export function sendError(
  res: Response,
  message: string,
  code: ErrorCode | string,
  statusCode = 400,
  details?: string
): void {
  const response: ApiResponse = {
    success: false,
    error: message,
    code,
    details,
  };

  logger.warn('API Error Response', {
    code,
    statusCode,
    message,
    details,
  });

  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: any, res: Response, next: any) => Promise<any>
): (req: any, res: Response, next: any) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
