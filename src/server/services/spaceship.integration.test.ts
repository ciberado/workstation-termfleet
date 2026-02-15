/**
 * Integration tests for Spaceship DNS API
 * These tests make real API calls and require valid credentials
 * 
 * Run with: npm test -- spaceship.integration.test.ts
 */

import 'dotenv/config';

const SPACESHIP_API_BASE = 'https://spaceship.dev/api/v1';
const API_KEY = process.env.TERMFLEET_SPACESHIP_API_KEY;
const API_SECRET = process.env.TERMFLEET_SPACESHIP_API_SECRET;
const DOMAIN = process.env.TERMFLEET_BASE_DOMAIN || 'aprender.cloud';

interface DnsRecord {
  type: string;
  name: string;
  address?: string;
  value?: string;
  ttl?: number;
}

interface DnsRecordsResponse {
  items: DnsRecord[];
}

/**
 * Make authenticated request to Spaceship API
 */
async function spaceshipRequest(
  method: string,
  endpoint: string,
  body: unknown = null
): Promise<any> {
  const url = `${SPACESHIP_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'X-API-Key': API_KEY!,
    'X-API-Secret': API_SECRET!,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

describe('Spaceship API Integration', () => {
  // Skip tests if credentials are not available
  const skipIfNoCredentials = API_KEY && API_SECRET ? test : test.skip;

  beforeAll(() => {
    if (!API_KEY || !API_SECRET) {
      console.warn('⚠️  Skipping Spaceship API tests: credentials not found in environment');
      console.warn('   Set TERMFLEET_SPACESHIP_API_KEY and TERMFLEET_SPACESHIP_API_SECRET to run these tests');
    }
  });

  describe('DNS Records Management', () => {
    let testRecordName: string;

    skipIfNoCredentials('should list existing DNS records', async () => {
      const result: DnsRecordsResponse = await spaceshipRequest(
        'GET',
        `/dns/records/${DOMAIN}?take=10&skip=0`
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    skipIfNoCredentials('should create a DNS record', async () => {
      testRecordName = `test-${Date.now()}`;
      const testIp = '1.2.3.4';

      const record: DnsRecord = {
        type: 'A',
        name: testRecordName,
        address: testIp,
        ttl: 600,
      };

      const response = await spaceshipRequest('PUT', `/dns/records/${DOMAIN}`, {
        force: false,
        items: [record],
      });

      // PUT returns 204 No Content on success
      expect(response).toBeNull();
    });

    skipIfNoCredentials('should verify created record exists', async () => {
      // Use the record name from previous test
      testRecordName = testRecordName || `test-${Date.now()}`;

      const result: DnsRecordsResponse = await spaceshipRequest(
        'GET',
        `/dns/records/${DOMAIN}?take=500&skip=0`
      );

      const found = result.items.find(
        (r) => r.name === testRecordName && r.type === 'A'
      );

      expect(found).toBeDefined();
      expect(found?.address).toBe('1.2.3.4');
      expect(found?.ttl).toBe(600);
    });

    skipIfNoCredentials('should delete a DNS record', async () => {
      // Get the record first
      const result: DnsRecordsResponse = await spaceshipRequest(
        'GET',
        `/dns/records/${DOMAIN}?take=500&skip=0`
      );

      const record = result.items.find(
        (r) => r.name === testRecordName && r.type === 'A'
      );

      if (!record) {
        throw new Error('Test record not found for deletion');
      }

      // Delete the record
      const response = await spaceshipRequest('DELETE', `/dns/records/${DOMAIN}`, [
        {
          type: 'A',
          name: testRecordName,
          address: record.address,
        },
      ]);

      // DELETE returns 204 No Content on success
      expect(response).toBeNull();
    });

    skipIfNoCredentials('should verify deleted record is gone', async () => {
      const result: DnsRecordsResponse = await spaceshipRequest(
        'GET',
        `/dns/records/${DOMAIN}?take=500&skip=0`
      );

      const found = result.items.find(
        (r) => r.name === testRecordName && r.type === 'A'
      );

      expect(found).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    skipIfNoCredentials('should handle invalid domain', async () => {
      await expect(
        spaceshipRequest('GET', '/dns/records/invalid-domain-xyz.com?take=10&skip=0')
      ).rejects.toThrow(/404/);
    });

    skipIfNoCredentials('should handle missing record deletion', async () => {
      const nonExistentRecord = {
        type: 'A',
        name: 'nonexistent-record-xyz',
        address: '1.1.1.1',
      };

      // This might succeed (204) or fail depending on API behavior
      // Just verify it doesn't crash
      await expect(
        spaceshipRequest('DELETE', `/dns/records/${DOMAIN}`, [nonExistentRecord])
      ).resolves.toBeDefined();
    });
  });
});
