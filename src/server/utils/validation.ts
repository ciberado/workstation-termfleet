import { ErrorCode } from '../../shared/types.js';

/**
 * Validate workstation name format
 * Must be alphanumeric with hyphens, 3-63 characters
 */
export function validateWorkstationName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required and must be a string' };
  }

  if (name.length < 3 || name.length > 63) {
    return { valid: false, error: 'Name must be between 3 and 63 characters' };
  }

  // Must start with alphanumeric, can contain hyphens, end with alphanumeric
  const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
  if (!nameRegex.test(name)) {
    return {
      valid: false,
      error: 'Name must start and end with alphanumeric characters and can contain hyphens',
    };
  }

  return { valid: true };
}

/**
 * Validate IPv4 address format
 */
export function validateIpv4(ip: string): { valid: boolean; error?: string } {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required and must be a string' };
  }

  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipRegex);

  if (!match) {
    return { valid: false, error: 'Invalid IPv4 address format' };
  }

  // Check each octet is 0-255
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10);
    if (octet < 0 || octet > 255) {
      return { valid: false, error: 'IPv4 address octets must be between 0 and 255' };
    }
  }

  return { valid: true };
}

/**
 * Validate registration request
 */
export function validateRegistrationRequest(body: any): {
  valid: boolean;
  error?: string;
  code?: ErrorCode;
} {
  const { name, ip } = body;

  const nameValidation = validateWorkstationName(name);
  if (!nameValidation.valid) {
    return {
      valid: false,
      error: nameValidation.error,
      code: ErrorCode.INVALID_INPUT,
    };
  }

  const ipValidation = validateIpv4(ip);
  if (!ipValidation.valid) {
    return {
      valid: false,
      error: ipValidation.error,
      code: ErrorCode.INVALID_INPUT,
    };
  }

  return { valid: true };
}
