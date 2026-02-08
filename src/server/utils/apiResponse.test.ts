import { describe, it, expect, jest } from '@jest/globals';
import { sendSuccess, sendError } from './apiResponse.js';
import { ErrorCode } from '../../shared/types.js';
import type { Response } from 'express';

// Mock Response object
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('API Response Utils', () => {
  describe('sendSuccess', () => {
    it('should send success response with 200 status by default', () => {
      const res = createMockResponse();
      const data = { name: 'desk1', ip: '192.168.1.100' };

      sendSuccess(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with custom status code', () => {
      const res = createMockResponse();
      const data = { name: 'desk1' };

      sendSuccess(res, data, 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should handle null data', () => {
      const res = createMockResponse();

      sendSuccess(res, null);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should handle array data', () => {
      const res = createMockResponse();
      const data = [{ name: 'desk1' }, { name: 'desk2' }];

      sendSuccess(res, data);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with default 400 status', () => {
      const res = createMockResponse();

      sendError(res, 'Invalid input', ErrorCode.INVALID_INPUT);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input',
        code: ErrorCode.INVALID_INPUT,
        details: undefined,
      });
    });

    it('should send error response with custom status code', () => {
      const res = createMockResponse();

      sendError(res, 'Not found', ErrorCode.NOT_FOUND, 404);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not found',
        code: ErrorCode.NOT_FOUND,
        details: undefined,
      });
    });

    it('should include error details when provided', () => {
      const res = createMockResponse();
      const details = 'DNS lookup failed: NXDOMAIN';

      sendError(res, 'DNS error', ErrorCode.DNS_REGISTRATION_FAILED, 500, details);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'DNS error',
        code: ErrorCode.DNS_REGISTRATION_FAILED,
        details,
      });
    });

    it('should handle internal server errors', () => {
      const res = createMockResponse();

      sendError(res, 'Internal server error', ErrorCode.INTERNAL_ERROR, 500);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        code: ErrorCode.INTERNAL_ERROR,
        details: undefined,
      });
    });

    it('should handle missing error code', () => {
      const res = createMockResponse();

      sendError(res, 'Something went wrong', ErrorCode.INTERNAL_ERROR);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Something went wrong',
        })
      );
    });
  });
});
