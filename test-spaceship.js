#!/usr/bin/env node

/**
 * Simple test script for Spaceship API
 * Tests authentication and basic DNS operations
 */

import 'dotenv/config';

const SPACESHIP_API_BASE = 'https://spaceship.dev/api/v1';
const API_KEY = process.env.TERMFLEET_SPACESHIP_API_KEY;
const API_SECRET = process.env.TERMFLEET_SPACESHIP_API_SECRET;
const DOMAIN = process.env.TERMFLEET_BASE_DOMAIN || 'ws.aprender.cloud';

console.log('='.repeat(60));
console.log('Spaceship API Test');
console.log('='.repeat(60));
console.log(`Domain: ${DOMAIN}`);
console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`API Secret: ${API_SECRET ? API_SECRET.substring(0, 8) + '...' : 'NOT SET'}`);
console.log('='.repeat(60));

if (!API_KEY || !API_SECRET) {
  console.error('❌ Error: API credentials not found in environment');
  console.error('Please ensure TERMFLEET_SPACESHIP_API_KEY and TERMFLEET_SPACESHIP_API_SECRET are set in .env');
  process.exit(1);
}

/**
 * Make authenticated request to Spaceship API
 */
async function spaceshipRequest(method, endpoint, body = null) {
  const url = `${SPACESHIP_API_BASE}${endpoint}`;

  const headers = {
    'X-API-Key': API_KEY,
    'X-API-Secret': API_SECRET,
    'Content-Type': 'application/json',
  };

  console.log(`\n📡 ${method} ${endpoint}`);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Test 1: List existing DNS records
 */
async function testListRecords() {
  console.log('\n' + '─'.repeat(60));
  console.log('Test 1: List Existing DNS Records');
  console.log('─'.repeat(60));

  try {
    const result = await spaceshipRequest('GET', `/dns/records/${DOMAIN}?take=10&skip=0`);
    
    if (result && result.items) {
      console.log(`   ✅ Success! Found ${result.items.length} DNS record(s)`);
      
      if (result.items.length > 0) {
        console.log('\n   Current records:');
        result.items.forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.type} ${record.name || '@'} → ${record.address || record.value || 'N/A'}`);
        });
      } else {
        console.log('   (No DNS records found for this domain)');
      }
      
      return true;
    } else {
      console.log('   ⚠️  Warning: Unexpected response format');
      console.log('   Response:', JSON.stringify(result, null, 2));
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Create a test DNS record
 */
async function testCreateRecord() {
  console.log('\n' + '─'.repeat(60));
  console.log('Test 2: Create Test DNS Record');
  console.log('─'.repeat(60));

  const testName = 'api-test-' + Date.now();
  const testIp = '1.2.3.4';

  console.log(`   Creating: ${testName}.${DOMAIN} → ${testIp}`);

  try {
    const record = {
      type: 'A',
      name: testName,
      address: testIp,
      ttl: 600,
    };

    await spaceshipRequest('PUT', `/dns/records/${DOMAIN}`, {
      force: false,
      items: [record],
    });

    console.log(`   ✅ Success! DNS record created`);
    console.log(`   Record: ${testName}.${DOMAIN} → ${testIp}`);
    
    return testName;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return null;
  }
}

/**
 * Test 3: Verify the created record exists
 */
async function testVerifyRecord(recordName) {
  console.log('\n' + '─'.repeat(60));
  console.log('Test 3: Verify Record Exists');
  console.log('─'.repeat(60));

  try {
    const result = await spaceshipRequest('GET', `/dns/records/${DOMAIN}?take=500&skip=0`);
    
    if (result && result.items) {
      const found = result.items.find(r => r.name === recordName && r.type === 'A');
      
      if (found) {
        console.log(`   ✅ Success! Record found in DNS`);
        console.log(`   Details: ${found.name}.${DOMAIN} → ${found.address} (TTL: ${found.ttl})`);
        return true;
      } else {
        console.log(`   ⚠️  Warning: Record not found in DNS listing`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Delete the test record
 */
async function testDeleteRecord(recordName) {
  console.log('\n' + '─'.repeat(60));
  console.log('Test 4: Delete Test Record (Cleanup)');
  console.log('─'.repeat(60));

  try {
    // First get the record details
    const result = await spaceshipRequest('GET', `/dns/records/${DOMAIN}?take=500&skip=0`);
    const record = result.items.find(r => r.name === recordName && r.type === 'A');

    if (!record) {
      console.log(`   ⚠️  Record not found, skipping deletion`);
      return true;
    }

    // Delete the record
    await spaceshipRequest('DELETE', `/dns/records/${DOMAIN}`, [
      {
        type: 'A',
        name: recordName,
        address: record.address,
      }
    ]);

    console.log(`   ✅ Success! Test record deleted`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    console.error(`   Note: You may need to manually delete ${recordName}.${DOMAIN}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting Spaceship API tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;
  let testRecordName = null;

  // Test 1: List records
  if (await testListRecords()) {
    testsPassed++;
    console.log('   ✅ Test 1 PASSED');
  } else {
    testsFailed++;
    console.log('   ❌ Test 1 FAILED');
  }

  // Test 2: Create record
  testRecordName = await testCreateRecord();
  if (testRecordName) {
    testsPassed++;
    console.log('   ✅ Test 2 PASSED');
  } else {
    testsFailed++;
    console.log('   ❌ Test 2 FAILED');
  }

  // Test 3: Verify record (only if creation succeeded)
  if (testRecordName) {
    if (await testVerifyRecord(testRecordName)) {
      testsPassed++;
      console.log('   ✅ Test 3 PASSED');
    } else {
      testsFailed++;
      console.log('   ❌ Test 3 FAILED');
    }
  } else {
    console.log('\n   ⏭️  Test 3 SKIPPED (creation failed)');
  }

  // Test 4: Delete record (only if creation succeeded)
  if (testRecordName) {
    if (await testDeleteRecord(testRecordName)) {
      testsPassed++;
      console.log('   ✅ Test 4 PASSED');
    } else {
      testsFailed++;
      console.log('   ❌ Test 4 FAILED');
    }
  } else {
    console.log('\n   ⏭️  Test 4 SKIPPED (creation failed)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total:  ${testsPassed + testsFailed}`);
  console.log('='.repeat(60));

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Spaceship API is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
