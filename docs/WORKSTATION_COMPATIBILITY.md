# Workstation Project Compatibility Analysis

**Date:** February 8, 2026  
**Termfleet Version:** 2.1.1  
**Workstation Version:** 2.0.1

---

## Executive Summary

✅ **COMPATIBLE** - The workstation project is compatible with termfleet with **one minor integration step required**.

The workstation project includes all necessary components for termfleet integration:
- Registration script (`register-termfleet.sh`)
- Systemd service (`termfleet-registration.service`)
- Configuration template (`termfleet.conf.example`)
- Integration documentation (`TERMFLEET_INTEGRATION.md`)

**Action Required:** Add termfleet registration installation to `userdata.sh` (see Integration section)

---

## Compatibility Matrix

| Component | Workstation | Termfleet | Status | Notes |
|-----------|-------------|-----------|--------|-------|
| **Registration Endpoint** | POST with `{name, ip}` | Expects `{name, ip}` | ✅ Match | Exact format match |
| **Name Validation** | Uses hostname | Alphanumeric + hyphens, 3-63 chars | ✅ Compatible | Standard hostnames work |
| **IP Detection** | AWS metadata or interface IP | IPv4 format (0-255 octets) | ✅ Compatible | Standard IPv4 |
| **Health Check Protocol** | HTTPS via Caddy | HTTPS to root `/` | ✅ Compatible | ttyd serves web UI at root |
| **Health Check Port** | Caddy on 443 (HTTPS) | Domain-based (443) | ✅ Compatible | Standard HTTPS |
| **Response Code** | ttyd returns 200 OK | Expects 200 OK | ✅ Compatible | Standard success response |
| **Retry Logic** | 5 attempts, exponential backoff | Server handles idempotent requests | ✅ Compatible | Robust retry mechanism |
| **Logging** | `/var/log/termfleet-registration.log` | Winston logs on server | ✅ Compatible | Separate log files |

---

## Architecture Compatibility

### Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ WORKSTATION (userdata.sh boot sequence)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ Install ttyd on localhost:7681
                 ├─ Install Caddy (reverse proxy)
                 ├─ Configure HTTPS with public hostname
                 │
                 └─ Install Termfleet Registration Service
                    │
                    └─ systemd: termfleet-registration.service
                       │
                       ├─ Wait for network (30s timeout)
                       ├─ Detect IP (AWS metadata or interface)
                       ├─ POST to /api/workstations/register
                       │  └─ Body: {"name":"hostname","ip":"1.2.3.4"}
                       │
                       └─ Retry 5x with exponential backoff
                          │
                          └─ Success: Log and exit
                             Failure: Log error and systemd retry
                             
┌─────────────────────────────────────────────────────────────┐
│ TERMFLEET (receives registration)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ Validate: name (3-63 chars, alphanumeric+hyphen)
                 ├─ Validate: ip (IPv4 format, 0-255 octets)
                 │
                 ├─ Register DNS: desk1.ws.aprender.cloud → 1.2.3.4
                 │  └─ Spaceship.com API
                 │
                 ├─ Create/Update database record
                 │  └─ status: 'starting'
                 │  └─ timestamps: created_at, state_changed_at
                 │
                 └─ Return: 200 OK with domain info
                    └─ {"success":true,"data":{...}}

┌─────────────────────────────────────────────────────────────┐
│ TERMFLEET HEALTH CHECK JOB (every 20s)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ GET https://desk1.ws.aprender.cloud/
                 │  └─ Timeout: 10 seconds
                 │
                 ├─ Response 200 OK?
                 │  ├─ Yes: Transition 'starting' → 'online'
                 │  └─ No: Keep 'starting' (10min timeout)
                 │
                 └─ Update database
                    └─ status, last_check, state_changed_at
```

---

## Detailed Component Analysis

### 1. Registration Script (`register-termfleet.sh`)

**Workstation sends:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"$WORKSTATION_NAME","ip":"$ip"}' \
  "$TERMFLEET_ENDPOINT/api/workstations/register"
```

**Termfleet expects:**
```typescript
interface RegisterWorkstationRequest {
  name: string;  // 3-63 chars, alphanumeric + hyphen
  ip: string;    // IPv4 format (e.g., "3.3.3.3")
}
```

**Analysis:** ✅ **Perfect match** - JSON format and field names identical.

---

### 2. Name Validation

**Workstation:**
- Uses `hostname` command or `WORKSTATION_NAME` env var
- Standard Linux hostnames (alphanumeric, hyphens, dots)

**Termfleet:**
```typescript
// Regex: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i
// - Must start/end with alphanumeric
// - Can contain hyphens in middle
// - Length: 3-63 characters
```

**Analysis:** ✅ **Compatible** - Standard hostnames like `desk1`, `workstation-01`, `aws-host-123` all pass validation.

---

### 3. IP Address Detection

**Workstation:**
```bash
# Try AWS metadata first
ip=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Fallback to primary interface
if [ -z "$ip" ]; then
    ip=$(hostname -I | awk '{print $1}')
fi
```

**Termfleet:**
```typescript
// Regex: /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
// - Each octet: 0-255
// - Standard IPv4 format
```

**Analysis:** ✅ **Compatible** - Both AWS public IPs and interface IPs are valid IPv4 addresses.

---

### 4. Health Check Mechanism

**Workstation Stack:**
```
Internet → Caddy (HTTPS:443) → ttyd (HTTP:7681) → bash login
           ↑
           └─ Automatic HTTPS with public hostname
           └─ Serves ttyd web UI at root `/`
```

**Caddyfile:**
```caddy
${PUBLIC_HOSTNAME} {
	reverse_proxy localhost:7681 {
		header_up Host {host}
		header_up X-Real-IP {remote}
		header_up X-Forwarded-For {remote}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

**Termfleet Health Check:**
```typescript
// URL: https://<domain_name>/
// Method: GET
// Timeout: 10 seconds
// Success: response.status === 200
```

**Analysis:** ✅ **Compatible** - ttyd serves a web interface at root that returns 200 OK.

**Verification:**
- ttyd version 1.7.7 serves web UI at `/`
- Caddy proxies all requests including root
- HTTPS works with automatic Let's Encrypt (AWS hostname)
- Health check expects any 200 OK response (content agnostic)

---

### 5. Retry and Error Handling

**Workstation:**
```bash
MAX_RETRIES=5
RETRY_DELAY=10  # Starts at 10s, doubles each time

# Exponential backoff: 10s, 20s, 40s, 80s, 160s
# Total max wait: ~5 minutes before giving up
```

**Termfleet:**
- Registration endpoint is idempotent (same IP = returns existing)
- Handles duplicate registrations gracefully
- IP change triggers DNS update and state reset

**Analysis:** ✅ **Compatible** - Robust retry mechanism with exponential backoff. Server handles duplicate requests correctly.

---

### 6. State Machine Compatibility

**Termfleet States:**
```
STARTING → ONLINE → UNKNOWN → TERMINATED → (removed after 50min)
    ↓         ↓         ↓
    └─────────┴─────────┘ (can transition back to ONLINE on recovery)
```

**Workstation Behavior:**
1. **Boot:** Registers → `starting` state
2. **Health check succeeds:** `starting` → `online`
3. **Shutdown/reboot:** Health check fails → `online` → `unknown` (1 min)
4. **Prolonged offline:** `unknown` → `terminated` (10 min) → removed (50 min)
5. **Recovery:** Successful health check → `online` (auto-resume)

**Analysis:** ✅ **Compatible** - State transitions match expected workstation lifecycle.

---

## Integration Steps Required

### Current State

**Workstation project includes:**
- ✅ `register-termfleet.sh` - Registration script
- ✅ `termfleet-registration.service` - Systemd service
- ✅ `termfleet.conf.example` - Configuration template
- ✅ `TERMFLEET_INTEGRATION.md` - Integration documentation

**Missing from `userdata.sh`:**
- ⚠️ Termfleet registration installation steps

### Integration Code for `userdata.sh`

Add this section **after Caddy installation** but **before the end** of `userdata.sh`:

```bash
# =================================================================
# Termfleet Registration Service
# =================================================================

echo "Installing Termfleet registration service..."

# Set Termfleet endpoint (CUSTOMIZE THIS!)
TERMFLEET_ENDPOINT="https://your-termfleet-server.com"

# Download registration script (or copy from local path)
wget -O /usr/local/bin/register-termfleet.sh \
  https://raw.githubusercontent.com/your-org/workstation/main/src/register-termfleet.sh
chmod +x /usr/local/bin/register-termfleet.sh

# Download systemd service file (or copy from local path)
wget -O /etc/systemd/system/termfleet-registration.service \
  https://raw.githubusercontent.com/your-org/workstation/main/src/termfleet-registration.service

# Create configuration file
cat << EOF > /etc/termfleet.conf
# Termfleet Configuration
TERMFLEET_ENDPOINT=${TERMFLEET_ENDPOINT}
WORKSTATION_NAME=$(hostname)
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable termfleet-registration.service
systemctl start termfleet-registration.service

echo "Termfleet registration service installed and started"
echo "Check status: systemctl status termfleet-registration.service"
echo "View logs: journalctl -u termfleet-registration.service -f"

# =================================================================
```

**Alternative:** If deploying in controlled environment, copy files directly:

```bash
# Copy from local repository
cp /path/to/workstation/src/register-termfleet.sh /usr/local/bin/
cp /path/to/workstation/src/termfleet-registration.service /etc/systemd/system/
chmod +x /usr/local/bin/register-termfleet.sh

# Create config
cat << EOF > /etc/termfleet.conf
TERMFLEET_ENDPOINT=https://your-termfleet-server.com
WORKSTATION_NAME=$(hostname)
EOF

# Enable and start
systemctl daemon-reload
systemctl enable termfleet-registration.service
systemctl start termfleet-registration.service
```

---

## Testing Compatibility

### 1. Test Registration Manually

On a workstation:

```bash
# Export configuration
export TERMFLEET_ENDPOINT=https://your-termfleet-server.com
export WORKSTATION_NAME=test-desk

# Run registration script
/usr/local/bin/register-termfleet.sh

# Expected output:
# [2026-02-08 12:34:56] === Termfleet Workstation Registration Started ===
# [2026-02-08 12:34:56] Termfleet endpoint: https://your-termfleet-server.com
# [2026-02-08 12:34:56] Workstation name: test-desk
# [2026-02-08 12:34:57] Network is available
# [2026-02-08 12:34:57] Detected IP address: 3.14.159.26
# [2026-02-08 12:34:58] Registration successful!
# [2026-02-08 12:34:58] === Registration completed successfully ===
```

### 2. Verify Health Check

On termfleet server:

```bash
# Check if workstation was registered
curl http://localhost:3000/api/workstations | jq '.data[] | {name, status, domain_name}'

# Expected:
# {
#   "name": "test-desk",
#   "status": "starting",
#   "domain_name": "test-desk.ws.aprender.cloud"
# }

# Wait 20 seconds for health check
sleep 20

# Check again (should be 'online' now)
curl http://localhost:3000/api/workstations | jq '.data[] | select(.name=="test-desk")'

# Expected:
# {
#   "name": "test-desk",
#   "status": "online",  # Changed from 'starting'
#   ...
# }
```

### 3. Test Health Check Directly

```bash
# Test workstation endpoint (should return 200 OK)
curl -I https://test-desk.ws.aprender.cloud/

# Expected:
# HTTP/2 200 OK
# content-type: text/html
# ...
```

---

## Potential Issues and Solutions

### Issue 1: AWS Hostname Format

**Problem:** AWS EC2 public hostnames contain dots (e.g., `ec2-3-14-159-26.compute-1.amazonaws.com`)

**Impact:** Dots might not be valid in workstation names for DNS subdomain creation.

**Solution:** 
```bash
# In userdata.sh, sanitize hostname before registration:
WORKSTATION_NAME=$(hostname | sed 's/\./-/g' | cut -c1-63)
```

**Status:** ⚠️ **Minor risk** - Test with actual workstation hostnames.

---

### Issue 2: DNS Propagation Delay

**Problem:** DNS records take time to propagate (TTL = 600s = 10 minutes).

**Impact:** Initial health checks may fail due to DNS not being resolvable yet.

**Solution:** 
- Termfleet already handles this with `starting` state (10-minute timeout)
- Workstation stays in `starting` until first successful health check
- After 10 minutes without success, transitions to `unknown`

**Status:** ✅ **Already handled** by state machine.

---

### Issue 3: Workstation Behind NAT

**Problem:** If workstation detects private IP (10.x, 172.x, 192.168.x) instead of public IP.

**Impact:** DNS points to private IP, unreachable from termfleet.

**Solution:**
- Workstation already tries AWS metadata first (gets public IP)
- Fallback to interface IP only if metadata fails (non-AWS environments)

**Recommendation:** Always use AWS metadata for public IP detection.

**Status:** ✅ **Already handled** by registration script priority.

---

### Issue 4: Systemd Service Timing

**Problem:** Termfleet registration might run before network is fully ready.

**Impact:** Registration fails, systemd retries.

**Solution:**
- Service already has `After=network-online.target`
- Registration script has 30-second network wait with ping test
- Systemd restart policy: `on-failure` with 30s delay, 5 attempts max

**Status:** ✅ **Already handled** with robust wait logic.

---

## Recommendations

1. ✅ **Integration Ready** - Add termfleet registration to `userdata.sh` as shown above.

2. ✅ **Use AWS Metadata** - Prioritize AWS metadata for public IP detection (already implemented).

3. ⚠️ **Test Hostname Validation** - Verify workstation hostnames pass termfleet's name validation (alphanumeric + hyphen, 3-63 chars).

4. ✅ **Monitor Logs** - Use `journalctl -u termfleet-registration.service` on workstations and termfleet server logs to verify registration.

5. ✅ **Health Check Timing** - 20-second interval is appropriate for ~20-25 workstations. No changes needed.

6. ✅ **State Machine** - Current state transitions handle workstation lifecycle correctly. No changes needed.

---

## Conclusion

**Status: ✅ COMPATIBLE**

The workstation project is fully compatible with termfleet. All required components exist:
- Registration API format matches exactly
- Health check mechanism is compatible (ttyd serves 200 OK at root)
- Retry logic is robust with exponential backoff
- State machine handles workstation lifecycle appropriately
- Error handling covers network issues and DNS failures

**Single Action Required:**
Add termfleet registration installation to `userdata.sh` (copy the code snippet from "Integration Steps Required" section above).

After this integration, workstations will:
1. ✅ Auto-register on boot
2. ✅ Receive subdomain (e.g., `desk1.ws.aprender.cloud`)
3. ✅ Be monitored by health checks every 20 seconds
4. ✅ Appear in termfleet dashboard with real-time status
5. ✅ Support auto-recovery (offline → online transitions)

---

**Next Steps:**
1. Add integration code to `userdata.sh`
2. Deploy test workstation
3. Verify registration in termfleet dashboard
4. Confirm health checks transition to 'online' status
5. Test recovery (stop/start workstation, verify state transitions)
