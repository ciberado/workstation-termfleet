import { describe, it, expect } from '@jest/globals';
import { validateRegistrationRequest, validateWorkstationName, validateIPv4Address } from '../validation';
import { ErrorCode } from '../../../shared/types';

describe('Validation Utils', () => {
  describe('validateWorkstationName', () => {
    it('should accept valid alphanumeric names', () => {
      expect(validateWorkstationName('desk1')).toBe(true);
      expect(validateWorkstationName('server123')).toBe(true);
      expect(validateWorkstationName('my-workstation')).toBe(true);
      expect(validateWorkstationName('test')).toBe(true);
    });

    it('should accept names with hyphens', () => {
      expect(validateWorkstationName('my-desk-1')).toBe(true);
      expect(validateWorkstationName('test-server-prod')).toBe(true);
    });

    it('should reject names with invalid characters', () => {
      expect(validateWorkstationName('desk_1')).toBe(false); // underscore
      expect(validateWorkstationName('desk.1')).toBe(false); // dot
      expect(validateWorkstationName('desk 1')).toBe(false); // space
      expect(validateWorkstationName('desk@1')).toBe(false); // special char
    });

    it('should reject empty names', () => {
      expect(validateWorkstationName('')).toBe(false);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(64);
      expect(validateWorkstationName(longName)).toBe(false);
    });

    it('should reject names starting or ending with hyphen', () => {
      expect(validateWorkstationName('-desk')).toBe(false);
      expect(validateWorkstationName('desk-')).toBe(false);
    });
  });

  describe('validateIPv4Address', () => {
    it('should accept valid IP addresses', () => {
      expect(validateIPv4Address('192.168.1.1')).toBe(true);
      expect(validateIPv4Address('10.0.0.1')).toBe(true);
      expect(validateIPv4Address('172.16.0.1')).toBe(true);
      expect(validateIPv4Address('8.8.8.8')).toBe(true);
      expect(validateIPv4Address('255.255.255.255')).toBe(true);
      expect(validateIPv4Address('0.0.0.0')).toBe(true);
    });

    it('should reject invalid IP formats', () => {
      expect(validateIPv4Address('256.1.1.1')).toBe(false); // > 255
      expect(validateIPv4Address('192.168.1')).toBe(false); // missing octet
      expect(validateIPv4Address('192.168.1.1.1')).toBe(false); // too many octets
      expect(validateIPv4Address('192.168.1.a')).toBe(false); // non-numeric
      expect(validateIPv4Address('192.168.-1.1')).toBe(false); // negative
    });

    it('should reject empty strings', () => {
      expect(validateIPv4Address('')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(validateIPv4Address('not-an-ip')).toBe(false);
    });
  });

  describe('validateRegistrationRequest', () => {
    it('should accept valid registration requests', () => {
      const result = validateRegistrationRequest({
        name: 'desk1',
        ip: '192.168.1.100',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.code).toBeUndefined();
    });

    it('should reject missing name', () => {
      const result = validateRegistrationRequest({
        name: '',
        ip: '192.168.1.100',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Workstation name is required');
      expect(result.code).toBe(ErrorCode.INVALID_NAME);
    });

    it('should reject invalid name format', () => {
      const result = validateRegistrationRequest({
        name: 'desk_1',
        ip: '192.168.1.100',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric');
      expect(result.code).toBe(ErrorCode.INVALID_NAME);
    });

    it('should reject missing IP', () => {
      const result = validateRegistrationRequest({
        name: 'desk1',
        ip: '',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP address is required');
      expect(result.code).toBe(ErrorCode.INVALID_IP);
    });

    it('should reject invalid IP format', () => {
      const result = validateRegistrationRequest({
        name: 'desk1',
        ip: '256.1.1.1',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid IPv4');
      expect(result.code).toBe(ErrorCode.INVALID_IP);
    });

    it('should handle missing fields', () => {
      const result = validateRegistrationRequest({} as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
