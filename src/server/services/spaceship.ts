import { config } from '../config.js';
import { logger } from '../logger.js';

const SPACESHIP_API_BASE = 'https://spaceship.dev/api/v1';

interface DnsRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  address?: string;
  ttl?: number;
}

/**
 * Make authenticated request to Spaceship API
 */
async function spaceshipRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${SPACESHIP_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'X-API-Key': config.spaceshipApiKey,
    'X-API-Secret': config.spaceshipApiSecret,
    'Content-Type': 'application/json',
  };

  try {
    logger.debug('Spaceship API request', { method, endpoint });

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spaceship API error (${response.status}): ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    logger.error('Spaceship API request failed', {
      method,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Register or update DNS A record for workstation
 */
export async function registerDnsRecord(
  workstationName: string,
  ipAddress: string
): Promise<{ domain: string; success: boolean }> {
  const domain = config.baseDomain;
  const fullDomain = `${workstationName}.${domain}`;

  logger.info('Registering DNS record', { workstationName, ipAddress, fullDomain });

  try {
    // Create or update A record using Spaceship API
    const record: DnsRecord = {
      type: 'A',
      name: workstationName,
      address: ipAddress,
      ttl: config.dnsTtl,
    };

    await spaceshipRequest('PUT', `/dns/records/${domain}`, {
      force: false,
      items: [record],
    });

    logger.info('DNS record registered successfully', { fullDomain, ipAddress });

    return {
      domain: fullDomain,
      success: true,
    };
  } catch (error) {
    logger.error('Failed to register DNS record', {
      workstationName,
      ipAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`DNS registration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if DNS has propagated globally
 * For now, we'll perform a simple DNS lookup
 */
export async function checkDnsPropagation(fullDomain: string): Promise<boolean> {
  logger.debug('Checking DNS propagation', { fullDomain });

  try {
    // Perform DNS lookup using node's dns module
    const { promises: dns } = await import('dns');

    try {
      const addresses = await dns.resolve4(fullDomain);
      const propagated = addresses.length > 0;

      logger.debug('DNS propagation check result', {
        fullDomain,
        propagated,
        addresses,
      });

      return propagated;
    } catch (dnsError) {
      // DNS resolution failed, domain not propagated yet
      logger.debug('DNS not yet propagated', {
        fullDomain,
        error: dnsError instanceof Error ? dnsError.message : String(dnsError),
      });
      return false;
    }
  } catch (error) {
    logger.error('DNS propagation check failed', {
      fullDomain,
      error: error instanceof Error ? error.message : String(error),
    });
    // On error, return false (graceful degradation)
    return false;
  }
}

/**
 * Delete DNS record for workstation
 */
export async function deleteDnsRecord(
  workstationName: string
): Promise<{ success: boolean }> {
  const domain = config.baseDomain;
  const fullDomain = `${workstationName}.${domain}`;

  logger.info('Deleting DNS record', { workstationName, fullDomain });

  try {
    // Get current IP address first (required for deletion)
    const records = await spaceshipRequest<{ items: DnsRecord[] }>(
      'GET',
      `/dns/records/${domain}?take=500&skip=0`
    );

    const record = records.items.find((r) => r.name === workstationName && r.type === 'A');

    if (!record) {
      logger.warn('DNS record not found for deletion', { workstationName });
      return { success: false };
    }

    // Delete the record
    await spaceshipRequest('DELETE', `/dns/records/${domain}`, [
      {
        type: 'A',
        name: workstationName,
        address: record.address,
      },
    ]);

    logger.info('DNS record deleted successfully', { fullDomain });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete DNS record', {
      workstationName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`DNS deletion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
