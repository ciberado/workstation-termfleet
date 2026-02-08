# Testing Plan - Phase 8

**Date:** 2026-02-08  
**Status:** 🟡 In Progress (Manual Testing Priority)

## Overview

This document outlines the comprehensive testing strategy for Termfleet. Due to ES module import complexities with Jest in a TypeScript ESM project, the focus is on **manual integration testing** with documented test procedures.

## Testing Strategy

### 1. Manual Integration Testing (Primary Focus)

Manual testing provides the most value for this application, ensuring the complete workflow operates correctly with real workstations and DNS systems.

### 2. Unit Testing (Secondary - Infrastructure Ready)

Unit tests have been created for critical components but require Jest ESM configuration refinement:
- Validation logic tests ✅ Written
- State machine tests ✅ Written  
- API response utility tests ✅ Written
- Jest configuration ✅ Created

**Note:** Jest + TypeScript ESM import resolution needs additional configuration. Consider alternatives:
- Vitest (better ESM support)
- Convert to CommonJS for tests
- Use tsx for test execution

## Manual Testing Procedures

### Complete Workflow Test

**Objective:** Verify end-to-end workstation lifecycle

**Prerequisites:**
- Termfleet server running
- Spaceship.com API credentials configured
- Test workstation with registration script installed

**Steps:**

1. **Server Startup**
   ```bash
   cd /workspaces/termfleet
   npm start
   ```
   
   **Expected:**
   - Server starts on port 3000
   - Database initialized
   - Health check scheduler starts
   - No errors in console/logs

2. **Workstation Registration**
   ```bash
   # On workstation
   export TERMFLEET_ENDPOINT=http://localhost:3000
   sudo /usr/local/bin/register-termfleet.sh
   ```
   
   **Expected:**
   - Network detected
   - IP address resolved
   - HTTP 201 response from registration
   - Workstation visible in database
   - Status: `starting`
   - DNS A record created
   - Logs show success

3. **Check Dashboard**
   ```bash
   # Open browser
   open http://localhost:3000
   ```
   
   **Expected:**
   - Dashboard loads
   - Workstation card appears
   - Status badge: Yellow ("starting")
   - IP address displayed
   - Domain name shown
   - "Open Terminal" button visible

4. **DNS Propagation Check**
   ```bash
   curl http://localhost:3000/api/workstations/<name>/propagation
   ```
   
   **Expected:**
   ```json
   {
     "success": true,
     "data": {
       "propagated": true,
       "expected_ip": "IP_HERE",
       "resolved_ip": "IP_HERE"
     }
   }
   ```

5. **Wait for Health Check (20 seconds)**
   
   **Expected:**
   - Health check job runs automatically
   - If ttyd responding: Status changes to `online`
   - If ttyd not responding: Status stays `starting`
   - Console logs show health check activity
   - Dashboard auto-refreshes to show new status

6. **Verify Online State**
   ```bash
   curl http://localhost:3000/api/workstations/<name>
   ```
   
   **Expected:**
   ```json
   {
     "success": true,
     "data": {
       "status": "online",
       "last_check": "RECENT_TIMESTAMP"
     }
   }
   ```

7. **Stop Workstation Service**
   ```bash
   # Stop ttyd or simulate workstation offline
   sudo systemctl stop ttyd
   ```
   
   **Expected:**
   - Wait 1 minute (online → unknown threshold)
   - Next health check fails
   - Status changes to `unknown`
   - `unknown_since` timestamp set
   - Dashboard shows red status badge

8. **Wait for Termination (10 minutes in unknown)**
   
   **Expected:**
   - After 10 minutes: Status changes to `terminated`
   - `terminated_at` timestamp set
   - Dashboard shows gray status badge
   - After additional 50 minutes: Workstation removed from database

9. **Restart Workstation (Recovery)**
   ```bash
   sudo systemctl start ttyd
   ```
   
   **Expected:**
   - Health check succeeds on next run
   - Status changes from `unknown` → `online`
   - `unknown_since` cleared
   - Dashboard shows green status badge

### Dashboard Functionality Tests

#### 1. Filter by Status
**Steps:**
1. Register multiple workstations with different statuses
2. Use status filter dropdown
3. Select each status

**Expected:**
- Only workstations with selected status shown
- Summary badges update
- Empty state shown when no matches

#### 2. Sort Functionality
**Steps:**
1. Click sort dropdown
2. Select different fields (name, status, created_at, last_check)
3. Toggle sort direction

**Expected:**
- Workstations reorder correctly
- Ascending/descending works
- Visual indicator shows sort direction

#### 3. Auto-Refresh
**Steps:**
1. Keep dashboard open
2. Change workstation status (via API or wait for health check)
3. Observe dashboard updates

**Expected:**
- Dashboard refreshes every 5 seconds
- New data appears without manual refresh
- No flickering or UI issues

#### 4. Terminal Link
**Steps:**
1. Click "Open Terminal" button on workstation card

**Expected:**
- New tab opens
- URL: `https://<workstation>.ws.aprender.cloud`
- ttyd web terminal loads (if workstation online)

### API Endpoint Tests

#### 1. Registration Endpoint
```bash
# Valid registration
curl -X POST http://localhost:3000/api/workstations/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test1","ip":"192.168.1.100"}'
```

**Expected:** HTTP 201, workstation created

```bash
# Invalid name
curl -X POST http://localhost:3000/api/workstations/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test_invalid","ip":"192.168.1.100"}'
```

**Expected:** HTTP 400, validation error

```bash
# Invalid IP
curl -X POST http://localhost:3000/api/workstations/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test1","ip":"999.999.999.999"}'
```

**Expected:** HTTP 400, validation error

#### 2. List Endpoint
```bash
# List all
curl http://localhost:3000/api/workstations

# Filter by status
curl "http://localhost:3000/api/workstations?status=online"

# Sort by name
curl "http://localhost:3000/api/workstations?sort=name&order=asc"
```

**Expected:** Filtered/sorted results

#### 3. Single Workstation Endpoint
```bash
# Existing workstation
curl http://localhost:3000/api/workstations/test1

# Non-existent
curl http://localhost:3000/api/workstations/nonexistent
```

**Expected:** 200 with data | 404 not found

### Rate Limiting Test

```bash
# Send 101 requests in quick succession
for i in {1..101}; do
  curl http://localhost:3000/health
done
```

**Expected:**
- First 100 requests: HTTP 200
- Request 101: HTTP 429 Too Many Requests
- Error logged with IP address

### Error Handling Tests

#### 1. Invalid JSON
```bash
curl -X POST http://localhost:3000/api/workstations/register \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

**Expected:** HTTP 400, parse error

#### 2. Missing Required Fields
```bash
curl -X POST http://localhost:3000/api/workstations/register \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** HTTP 400, validation errors

#### 3. DNS Failure Simulation
- Disable Spaceship API credentials
- Attempt registration

**Expected:**
- Workstation created with `dns_failed` status
- Error details in `dns_error` field
- Still accessible via API

### Load Testing

**Objective:** Verify system handles 20 concurrent workstations

**Setup:**
1. Register 20 workstations via script:
   ```bash
   for i in {1..20}; do
     curl -X POST http://localhost:3000/api/workstations/register \
       -H "Content-Type: application/json" \
       -d "{\"name\":\"desk$i\",\"ip\":\"192.168.1.$((100 + i))\"}"
     sleep 1
   done
   ```

**Expected:**
- All 20 workstations registered successfully
- Health check job completes within 20 seconds
- Dashboard loads and displays all 20 cards
- No performance degradation
- Logs show parallel health checking

**Monitor:**
- CPU usage (should be minimal)
- Memory usage (should be stable)
- Database file size
- Log file sizes

### Logging Tests

#### 1. Verify Log Output
```bash
# Check logs directory
ls -lh logs/

# View combined log
tail -f logs/combined.log

# View error log
tail -f logs/error.log
```

**Expected:**
- Both files exist
- combined.log contains all logs
- error.log contains only errors
- JSON format
- Timestamps present
- Request IDs tracked

#### 2. Log Rotation Test
```bash
# Generate enough logs to trigger rotation (>10MB)
# Or manually create large file
dd if=/dev/zero of=logs/combined.log bs=1M count=11
```

**Expected:**
- Old file renamed/rotated
- New file created
- Max 5 files retained

### Security Tests

#### 1. Sensitive Data Check
```bash
# Grep logs for sensitive data
grep -r "SPACESHIP_API_KEY" logs/
grep -r "SPACESHIP_API_SECRET" logs/
```

**Expected:** No matches

#### 2. CORS Test
```bash
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:3000/api/workstations/register
```

**Expected:** CORS headers present (configured to allow all by default in dev)

## Test Results Documentation

### Test Execution Tracking

| Test | Status | Date | Notes |
|------|--------|------|-------|
| Server Startup | ✅ | 2026-02-08 | Passed |
| Workstation Registration | ⏳ | Pending | Requires live environment |
| Dashboard Load | ⏳ | Pending | Requires build |
| DNS Propagation | ⏳ | Pending | Requires Spaceship credentials |
| Health Check Cycle | ⏳ | Pending | Requires live workstation |
| State Transitions | ⏳ | Pending | |
| Filter/Sort | ⏳ | Pending | |
| Rate Limiting | ⏳ | Pending | |
| Load Test (20 workstations) | ⏳ | Pending | |

### Known Issues

1. **Jest ESM Configuration**
   - Status: Needs resolution
   - Impact: Unit tests cannot run
   - Workaround: Manual testing + future Vitest migration

2. **DNS Testing**
   - Status: Requires live Spaceship account
   - Impact: Cannot fully test DNS integration locally
   - Workaround: Mock DNS service or use test domain

## Recommendations

### Immediate Actions

1. **Complete Manual Testing**
   - Set up test workstation
   - Execute complete workflow
   - Document results

2. **Fix Jest Configuration**
   - Consider migrating to Vitest
   - Or adjust TypeScript/Jest configuration for ESM
   - Alternative: Use tsx for direct test execution

3. **Add Integration Test Script**
   - Create bash script to automate API testing
   - Use curl + jq for assertions
   - Easier than Jest configuration

### Future Enhancements

1. **E2E Testing**
   - Playwright for frontend testing
   - Test actual user interactions
   - Screenshot comparison

2. **Performance Testing**
   - Apache Bench (ab) for load testing
   - Monitor response times under load
   - Database query optimization

3. **CI/CD Integration**
   - GitHub Actions workflow
   - Automated test execution
   - Coverage reports

## Acceptance Criteria Status

- ⏳ 80%+ code coverage - **Blocked** (Jest configuration)
- ⏳ All tests passing - **Blocked** (Jest configuration)
- ⏳ Manual workflow tested - **Pending** (requires environment)
- ✅ Edge cases identified - **Complete** (documented)
- ⏳ Performance acceptable - **Pending** (requires load test)

## Conclusion

**Phase 8 Status:** 🟡 **Partial - Manual Testing Ready**

Test infrastructure is in place with comprehensive test procedures documented. Unit tests are written but blocked on Jest ESM configuration. **Manual integration testing is the recommended approach** for immediate validation.

**Priority:** Execute manual testing procedures with real workstation to validate complete workflow.

**Next Steps:**
1. Resolve Jest ESM configuration or migrate to Vitest
2. Execute manual test procedures
3. Document test results
4. Proceed to Phase 9 (Documentation & Polish)

---

**Created by:** GitHub Copilot  
**Date:** February 8, 2026
