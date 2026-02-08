import { describe, it, expect } from '@jest/globals';
import { validateRegistrationRequest, validateWorkstationName, validateIpv4 } from './validation.js';
import { ErrorCode } from '../../shared/types.js';

describe('Validation Utils', () => {
  describe('validateWorkstationName', () => {
    it('should accept valid alphanumeric names', () => {
      expect(validateWorkstationName('desk1').valid).toBe(true);
      expect(validateWorkstationName('server123').valid).toBe(true);
      expect(validateWorkstationName('my-workstation').valid).toBe(true);
      expect(validateWorkstationName('test').valid).toBe(true);
    });

    it('should accept names with hyphens', () => {
      expect(validateWorkstationName('my-desk-1').valid).toBe(true);
      expect(validateWorkstationName('test-server-prod').valid).toBe(true);
    });

    it('should reject names with invalid characters', () => {
      expect(validateWorkstationName('desk_1').valid).toBe(false); // underscore
      expect(validateWorkstationName('desk.1').valid).toBe(false); // dot
      expect(validateWorkstationName('desk 1').valid).toBe(false); // space
      expect(validateWorkstationName('desk@1').valid).toBe(false); // special char
    });

    it('should reject empty names', () => {
      expect(validateWorkstationName('').valid).toBe(false);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(64);
      expect(validateWorkstationName(longName).valid).toBe(false);
    });

    it('should reject names starting or ending with hyphen', () => {
      expect(validateWorkstationName('-desk').valid).toBe(false);
      expect(validateWorkstationName('desk-').valid).toBe(false);
    });
  });

  describe('validateIpv4', () => {
    it('should accept valid IP addresses', () => {
      expect(validateIpv4('192.168.1.1').valid).toBe(true);
      expect(validateIpv4('10.0.0.1').valid).toBe(true);
      expect(validateIpv4('172.16.0.1').valid).toBe(true);
      expect(validateIpv4('8.8.8.8').valid).toBe(true);
      expect(validateIpv4('255.255.255.255').valid).toBe(true);
      expect(validateIpv4('0.0.0.0').valid).toBe(true);
    });

    it('should reject invalid IP formats', () => {
      expect(validateIpv4('256.1.1.1').valid).toBe(false); // > 255
      expect(validateIpv4('192.168.1').valid).toBe(false); // missing octet
      expect(validateIpv4('192.168.1.1.1').valid).toBe(false); // too many octets
      expect(validateIpv4('192.168.1.a').valid).toBe(false); // non-numeric
      expect(validateIpv4('192.168.-1.1').valid).toBe(false); // negative
    });

    it('should reject empty strings', () => {
      expect(validateIpv4('').valid).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(validateIpv4('not-an-ip').valid).toBe(false);
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
      expect(result.error).toBeDefined();
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should reject invalid name format', () => {
      const result = validateRegistrationRequest({
        name: 'desk_1',
        ip: '192.168.1.100',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should reject missing IP', () => {
      const result = validateRegistrationRequest({
        name: 'desk1',
        ip: '',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should reject invalid IP format', () => {
      const result = validateRegistrationRequest({
        name: 'desk1',
        ip: '256.1.1.1',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should handle missing fields', () => {
      const result = validateRegistrationRequest({} as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
