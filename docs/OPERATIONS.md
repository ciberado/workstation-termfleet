# Termfleet Operations Guide

**Version:** 1.0  
**Last Updated:** February 8, 2026

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring](#monitoring)
3. [Common Tasks](#common-tasks)
4. [Troubleshooting](#troubleshooting)
5. [Performance Tuning](#performance-tuning)
6. [Maintenance](#maintenance)
7. [Incident Response](#incident-response)

---

## Daily Operations

### Regular Health Checks

**Morning Checklist (5 minutes):**

1. **Check Service Status**
   ```bash
   sudo systemctl status termfleet
   ```
   Expected: **Active (running)**, green status

2. **Verify Dashboard Access**
   ```bash
   curl -I https://termfleet.yourdomain.com/
   ```
   Expected: **HTTP 200 OK**

3. **Check Health Endpoint**
   ```bash
   curl https://termfleet.yourdomain.com/health
   ```
   Expected:
   ```json
   {
     "status": "ok",
     "database": "ok"
   }
   ```

4. **Review Recent Errors**
   ```bash
   sudo journalctl -u termfleet --since "1 hour ago" -p err
   ```
   Expected: **No output** (no errors)

5. **Check Workstation Count**
   ```bash
   curl https://termfleet.yourdomain.com/api/workstations | jq '. | length'
   ```
   Expected: **Expected number of workstations**

### Dashboard Monitoring

Access: https://termfleet.yourdomain.com

**Key Metrics to Monitor:**
- **Summary badges**: Total, Online, Starting, Unknown, Terminated
- **Workstation cards**: Status colors (green = good, yellow = starting, red = unknown)
- **Last health check timestamps**: Should be recent (within last 20-30 seconds)

**Red Flags:**
- Many workstations stuck in "starting" (ttyd not responding)
- Many workstations in "unknown" (network issues or workstations down)
- Last check timestamps old (>2 minutes) - health check job may have crashed

---

## Monitoring

### Log Locations

| Log Type | Location |
|----------|----------|
| Application logs (JSON) | `/opt/termfleet/logs/combined.log` |
| Error logs only (JSON) | `/opt/termfleet/logs/error.log` |
| systemd journal | `sudo journalctl -u termfleet` |
| Caddy logs | `/var/log/caddy/termfleet.log` |

### Real-Time Log Monitoring

**Watch all logs:**
```bash
sudo journalctl -u termfleet -f
```

**Watch only errors:**
```bash
tail -f /opt/termfleet/logs/error.log | jq '.'
```

**Watch with filtering (e.g., only health checks):**
```bash
tail -f /opt/termfleet/logs/combined.log | jq 'select(.message | contains("health check"))'
```

### Log Analysis

**Count errors in last hour:**
```bash
journalctl -u termfleet --since "1 hour ago" --no-pager | grep -c ERROR
```

**Find most common errors:**
```bash
tail -1000 /opt/termfleet/logs/error.log | jq -r '.message' | sort | uniqmcd -c | sort -nr | head -10
```

**Extract all DNS registration failures:**
```bash
cat /opt/termfleet/logs/combined.log | jq 'select(.message | contains("DNS registration failed"))'
```

**Find slow health checks:**
```bash
cat /opt/termfleet/logs/combined.log | jq 'select(.message | contains("health check") and .duration > 5000)'
```

### Resource Monitoring

**CPU and Memory:**
```bash
# Current usage
ps aux | grep "node dist/server"

# With watch (updates every 2 seconds)
watch -n 2 'ps aux | grep "node dist/server" | grep -v grep'

# Using top
top -p $(pgrep -f "node dist/server")
```

**Disk Usage:**
```bash
# Overall disk usage
df -h /opt/termfleet

# Database size
du -h /opt/termfleet/data/termfleet.db

# Log directory size
du -h /opt/termfleet/logs/
```

**Database Statistics:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db "SELECT COUNT(*) as total_workstations FROM workstations;"
sqlite3 /opt/termfleet/data/termfleet.db "SELECT status, COUNT(*) FROM workstations GROUP BY status;"
```

### Automated Monitoring (Optional)

**Set up alerts with systemd-notify:**

Create watchdog script `/opt/termfleet/scripts/check-health.sh`:
```bash
#!/bin/bash
HEALTH=$(curl -s https://termfleet.yourdomain.com/health | jq -r '.status')

if [ "$HEALTH" != "ok" ]; then
    echo "Health check failed!" | mail -s "Termfleet Alert" admin@example.com
    exit 1
fi
```

**Add to cron:**
```cron
*/5 * * * * /opt/termfleet/scripts/check-health.sh
```

---

## Common Tasks

### Viewing Workstation Details

**List all workstations:**
```bash
curl https://termfleet.yourdomain.com/api/workstations | jq '.data[] | {name, status, ip_address, last_check}'
```

**Get single workstation:**
```bash
curl https://termfleet.yourdomain.com/api/workstations/desk1 | jq '.data'
```

**Filter by status:**
```bash
# All online workstations
curl "https://termfleet.yourdomain.com/api/workstations?status=online" | jq '.data[] | .name'

# All unknown workstations (need attention)
curl "https://termfleet.yourdomain.com/api/workstations?status=unknown" | jq '.data[] | {name, ip_address, unknown_since}'
```

### Manual DNS Operations

**Check DNS propagation for a workstation:**
```bash
curl https://termfleet.yourdomain.com/api/workstations/desk1/propagation | jq '.data'
```

**Manually verify DNS resolution:**
```bash
dig desk1.ws.aprender.cloud +short
nslookup desk1.ws.aprender.cloud
```

### Database Queries

**Connect to database:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db
```

**Useful queries:**
```sql
-- Count workstations by status
SELECT status, COUNT(*) as count 
FROM workstations 
GROUP BY status;

-- List workstations with stale last_check (>5 minutes ago)
SELECT name, status, last_check 
FROM workstations 
WHERE datetime(last_check) < datetime('now', '-5 minutes');

-- Find recently terminated workstations
SELECT name, status, terminated_at, terminated_reason 
FROM workstations 
WHERE status = 'terminated' 
ORDER BY terminated_at DESC 
LIMIT 10;

-- View recent events for a workstation
SELECT * 
FROM workstation_events 
WHERE workstation_name = 'desk1' 
ORDER BY timestamp DESC 
LIMIT 20;

-- Find workstations with DNS failures
SELECT name, ip_address, dns_error 
FROM workstations 
WHERE status = 'dns_failed';
```

### Forcing State Updates

**Manually trigger a state change (via database):**

⚠️ **Warning**: Only do this if you understand the state machine!

```bash
sqlite3 /opt/termfleet/data/termfleet.db "UPDATE workstations SET status='online', last_check=datetime('now') WHERE name='desk1';"
```

**Better approach:** Wait for next health check cycle (runs every 20 seconds)

### Restarting Services

**Graceful restart:**
```bash
sudo systemctl reload termfleet
```

**Full restart (stops health checks briefly):**
```bash
sudo systemctl restart termfleet
```

**Check status after restart:**
```bash
sudo systemctl status termfleet
sudo journalctl -u termfleet -n 50
```

---

## Troubleshooting

### Problem: Service Won't Start

**Symptoms:**
- `systemctl status termfleet` shows **failed** or **inactive (dead)**
- Dashboard not accessible

**Diagnosis:**
```bash
# Check logs for startup errors
sudo journalctl -u termfleet -n 100

# Common errors:
# - "Cannot find module" → npm install not run
# - "EADDRINUSE" → Port 3000 already in use
# - "EACCES" → Permission denied on database/logs
# - "Spaceship API error" → Check API credentials
```

**Solutions:**

1. **Missing dependencies:**
   ```bash
   cd /opt/termfleet
   npm install --production
   sudo systemctl restart termfleet
   ```

2. **Port in use:**
   ```bash
   # Find process on port 3000
   sudo lsof -i :3000
   
   # Kill it (if safe)
   sudo kill <PID>
   
   # Or change PORT in .env
   ```

3. **Database locked:**
   ```bash
   # Find processes using database
   sudo lsof /opt/termfleet/data/termfleet.db
   
   # Kill stale connections
   # Or restore from backup
   ```

4. **Permission errors:**
   ```bash
   sudo chown -R termfleet:termfleet /opt/termfleet/data
   sudo chown -R termfleet:termfleet /opt/termfleet/logs
   sudo systemctl restart termfleet
   ```

### Problem: Health Checks Not Running

**Symptoms:**
- Workstation `last_check` timestamps are old (>2 minutes)
- Dashboard not updating
- Logs show no recent health check activity

**Diagnosis:**
```bash
# Check if health check scheduler started
sudo journalctl -u termfleet | grep "health check scheduler"

# Check for health check errors
sudo journalctl -u termfleet | grep -i "health check error"
```

**Solutions:**

1. **Health check job crashed:**
   ```bash
   sudo systemctl restart termfleet
   # Watch logs to see health check start
   sudo journalctl -u termfleet -f
   ```

2. **Network issues preventing checks:**
   ```bash
   # Test workstation connectivity manually
   curl -m 10 http://192.168.1.100:7681/
   
   # Check firewall rules
   sudo iptables -L -n
   ```

### Problem: Workstations Stuck in "starting"

**Symptoms:**
- Workstations remain yellow "starting" status for >10 minutes
- Health checks timing out

**Diagnosis:**
```bash
# Check specific workstation
curl https://termfleet.yourdomain.com/api/workstations/desk1 | jq '.data'

# Check health check logs
sudo journalctl -u termfleet | grep "desk1" | grep "health check"

# Test ttyd directly from server
curl -m 10 http://<workstation-ip>:7681/
```

**Common Causes:**

1. **ttyd Service is Down**
   - Solution: Log into workstation, check `systemctl status ttyd`, start if needed

2. **Firewall Blocking Port 7681**
   - Solution: On workstation: `sudo ufw allow 7681/tcp`

3. **Workstation Not Reachable from Termfleet Server**
   - Solution: Check network connectivity, routing, VPN status

4. **Wrong IP Address Registered**
   - Solution: Check workstation's actual IP, may need to re-register

### Problem: DNS Registration Fails

**Symptoms:**
- Workstation has `status='dns_failed'`
- Logs show "DNS registration failed" or "Spaceship API error"

**Diagnosis:**
```bash
# Check workstation details
sqlite3 /opt/termfleet/data/termfleet.db "SELECT name, dns_error FROM workstations WHERE status='dns_failed';"

# Check Spaceship API credentials
cat /opt/termfleet/.env | grep SPACESHIP

# Test Spaceship API manually
curl -X GET "https://api.spaceship.com/v1/domains" \
  -H "X-API-Key: $SPACESHIP_API_KEY" \
  -H "X-API-Secret: $SPACESHIP_API_SECRET"
```

**Solutions:**

1. **Invalid API Credentials:**
   ```bash
   # Update .env with correct credentials
   sudo nano /opt/termfleet/.env
   
   # Restart service
   sudo systemctl restart termfleet
   ```

2. **API Rate Limiting:**
   - Check Spaceship API rate limits
   - Reduce registration rate or wait

3. **Domain Not Found in Spaceship:**
   - Ensure `ws.aprender.cloud` exists in Spaceship account
   - Check domain is active and not expired

4. **Network Issue:**
   - Test outbound HTTPS connectivity
   - Check firewall allows outbound port 443

### Problem: High CPU Usage

**Symptoms:**
- Server becomes slow or unresponsive
- High CPU usage in `top` or `htop`

**Diagnosis:**
```bash
# Check CPU usage
top -p $(pgrep -f "node dist/server")

# Check how many workstations
curl https://termfleet.yourdomain.com/api/workstations | jq '. | length'

# Check health check frequency
cat /opt/termfleet/.env | grep WORKSTATION_CHECK_INTERVAL
```

**Solutions:**

1. **Too Many Workstations:**
   - Increase health check interval: `WORKSTATION_CHECK_INTERVAL=30000` (30 seconds)
   - Consider scaling to multiple Termfleet instances

2. **Database Query Performance:**
   ```bash
   # Analyze and optimize database
   sqlite3 /opt/termfleet/data/termfleet.db "ANALYZE;"
   ```

3. **Memory Leak:**
   - Restart service: `sudo systemctl restart termfleet`
   - Monitor memory usage over time
   - Report issue if memory grows unbounded

### Problem: Dashboard Shows 404 or Won't Load

**Symptoms:**
- Opening dashboard shows "Cannot GET /" or 404
- Static assets (CSS/JS) not loading

**Diagnosis:**
```bash
# Check if frontend was built
ls -la /opt/termfleet/dist/client/

# Check Caddy reverse proxy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl status caddy
sudo journalctl -u caddy -n 50

# Check Node.js is serving correctly
curl http://localhost:3000/
```

**Solutions:**

1. **Frontend Not Built:**
   ```bash
   cd /opt/termfleet
   npm run build
   sudo systemctl restart termfleet
   ```

**2. Caddy Misconfiguration:**
   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   # Fix errors shown
   sudo systemctl reload caddy
   ```

3. **Static File Permission Issues:**
   ```bash
   sudo chown -R termfleet:termfleet /opt/termfleet/dist/
   sudo systemctl restart termfleet
   ```

### Problem: Rate Limiting Triggering Frequently

**Symptoms:**
- Users getting HTTP 429 "Too Many Requests"
- Logs show rate limit exceeded messages

**Diagnosis:**
```bash
# Check rate limit setting
cat /opt/termfleet/.env | grep MAX_REQUESTS_PER_MINUTE

# Check which IPs are hitting rate limit
cat /opt/termfleet/logs/combined.log | jq 'select(.message | contains("Rate limit")) | .ip' | sort | uniq -c | sort -nr
```

**Solutions:**

1. **Legitimate High Traffic:**
   ```bash
   # Increase limit in .env
   MAX_REQUESTS_PER_MINUTE=200
   
   # Restart
   sudo systemctl restart termfleet
   ```

2. **Abusive IP:**
   ```bash
   # Block at Caddy level
   # Add to /etc/caddy/Caddyfile under your site:
   @blocked remote_ip 1.2.3.4
   respond @blocked 403
   
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

3. **Automated Script Mis-Behaving:**
   - Identify source of requests
   - Contact user to reduce frequency
   - Implement exponential backoff on client side

---

## Performance Tuning

### Database Optimization

**Enable WAL mode** (if not already):
```bash
sqlite3 /opt/termfleet/data/termfleet.db "PRAGMA journal_mode=WAL;"
```

**Increase cache size:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db "PRAGMA cache_size=10000;"
```

**Run VACUUM and ANALYZE monthly:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db "VACUUM; ANALYZE;"
```

### Health Check Tuning

**For many workstations** (adjust in `.env`):
```env
# Reduce frequency (30 seconds instead of 20)
WORKSTATION_CHECK_INTERVAL=30000

# Reduce timeout (5 seconds instead of 10)
WORKSTATION_CHECK_TIMEOUT=5000
```

**Trade-off:** Less frequent checks = slower status updates, but lower CPU/network usage

### Log Level Adjustment

**Production:** Use `info` or `warn` to reduce disk I/O
```env
LOG_LEVEL=info
```

**Debugging:** Use `debug` for detailed logs
```env
LOG_LEVEL=debug
```

### Caddy Compression and Caching

Already configured in Caddyfile (see [DEPLOYMENT.md](DEPLOYMENT.md)), but ensure:
- Static assets cached with Cache-Control headers
- Responses compressed with gzip/zstd
- API responses not cached

---

## Maintenance

### Weekly Tasks

**1. Check Logs for Patterns (10 minutes)**
```bash
# Review error log
tail -100 /opt/termfleet/logs/error.log | jq '.'

# Check for trends
# - Repeated errors?
# - Specific workstations causing issues?
```

**2. Review Disk Usage (5 minutes)**
```bash
df -h /opt/termfleet
du -sh /opt/termfleet/logs/
du -sh /opt/termfleet/data/
```

**3. Check Workstation Health Distribution (5 minutes)**
```bash
curl https://termfleet.yourdomain.com/api/workstations | jq '[.data[] | .status] | group_by(.) | map({status: .[0], count: length})'
```

### Monthly Tasks

**1. Database Maintenance (15 minutes)**
```bash
# Stop service
sudo systemctl stop termfleet

# Backup database
/opt/termfleet/scripts/backup-db.sh

# Vacuum and analyze
sqlite3 /opt/termfleet/data/termfleet.db "VACUUM; ANALYZE;"

# Start service
sudo systemctl start termfleet
```

**2. Log Cleanup (5 minutes)**
```bash
# Check log sizes
du -h /opt/termfleet/logs/*.log

# Winston auto-rotates, but check backups
ls -lh /opt/termfleet/logs/

# Delete very old rotated logs (>90 days) if disk space low
find /opt/termfleet/logs/ -name "*.log.*" -mtime +90 -delete
```

**3. Review Backup Status (10 minutes)**
```bash
# Check backups exist
ls -lh /opt/termfleet/backups/

# Verify most recent backup
gunzip -c /opt/termfleet/backups/termfleet_$(ls -t /opt/termfleet/backups/ | head -1) | sqlite3 :memory: ".tables"
```

**4. Update Dependencies (20 minutes)**

⚠️ **Do during maintenance window, with rollback plan**

```bash
# Backup first
/opt/termfleet/scripts/backup-db.sh

# Check for updates
npm outdated

# Update minor/patch versions only (safer)
npm update

# Rebuild
npm run build

# Test locally
npm start
# Ctrl+C after verifying

# If OK, restart production
sudo systemctl restart termfleet

# Monitor logs
sudo journalctl -u termfleet -f
```

### Quarterly Tasks

**1. Security Audit (1 hour)**
- Review access logs for suspicious activity
- Update system packages: `sudo apt update && sudo apt upgrade`
- Verify SSL certificate is valid and auto-renewing
- Check Caddy security headers
- Review firewall rules

**2. Capacity Planning (30 minutes)**
- Average number of workstations
- Peak concurrent workstations
- Database growth rate
- Log disk usage trend
- Estimate when more disk space needed

---

## Incident Response

### Critical: Service is Down

**Impact:** All users cannot access dashboard or register workstations

**Response Plan:**

1. **Assess Situation (1 minute)**
   ```bash
   sudo systemctl status termfleet
   curl -I https://termfleet.yourdomain.com/
   ```

2. **Check Recent Changes (2 minutes)**
   - Was there a recent deployment?
   - Any infrastructure changes?

3. **Review Logs (3 minutes)**
   ```bash
   sudo journalctl -u termfleet -n 100 --no-pager
   tail -50 /opt/termfleet/logs/error.log
   ```

4. **Attempt Restart (1 minute)**
   ```bash
   sudo systemctl restart termfleet
   sudo systemctl status termfleet
   ```

5. **If Restart Fails** (5 minutes)
   - Rollback recent changes
   - Restore database from backup if corrupted
   - Check disk space: `df -h`
   - Check memory: `free -h`

6. **Escalate** if not resolved in 15 minutes
   - Notify engineering team
   - Check [GitHub Issues](https://github.com/your-org/termfleet/issues)

### High: Workstations Not Updating

**Impact:** Dashboard shows stale data, health checks not running

**Response Plan:**

1. **Verify Health Check Job Running (2 minutes)**
   ```bash
   sudo journalctl -u termfleet | tail -100 | grep "health check"
   ```

2. **Check for Errors (2 minutes)**
   ```bash
   tail -50 /opt/termfleet/logs/error.log | jq 'select(.message | contains("health"))'
   ```

3. **Restart Service (1 minute)**
   ```bash
   sudo systemctl restart termfleet
   # Monitor logs to see check scheduler start
   sudo journalctl -u termfleet -f
   ```

4. **Verify Recovery (3 minutes)**
   - Wait 30 seconds for health check cycle
   - Check dashboard for updated timestamps
   - Verify `last_check` field updating:
     ```bash
     watch -n 5 'curl -s https://termfleet.yourdomain.com/api/workstations/desk1 | jq ".data.last_check"'
     ```

### Medium: DNS Registration Failures

**Impact:** New workstations cannot get subdomains

**Response Plan:**

1. **Verify Spaceship API Access (2 minutes)**
   ```bash
   curl -X GET "https://api.spaceship.com/v1/domains" \
     -H "X-API-Key: $SPACESHIP_API_KEY" \
     -H "X-API-Secret: $SPACESHIP_API_SECRET"
   ```

2. **Check Failed Workstations (2 minutes)**
   ```bash
   sqlite3 /opt/termfleet/data/termfleet.db "SELECT name, dns_error FROM workstations WHERE status='dns_failed';"
   ```

3. **Manual DNS Creation** (5 minutes per workstation)
   - Log into Spaceship dashboard
   - Manually create A record
   - Update workstation status to `starting` in database

4. **Fix Root Cause**
   - Update API credentials if expired
   - Contact Spaceship support if API down
   - Check for IP-based rate limiting

---

## Contact & Support

**Internal Team:**
- On-call Engineer: [Contact details]
- DevOps Team: [Contact details]
- Slack Channel: #termfleet-ops

**External:**
- Spaceship.com Support: support@spaceship.com
- GitHub Issues: https://github.com/your-org/termfleet/issues

**Runbook Last Updated:** February 8, 2026

---

## Quick Command Reference

```bash
# Service management
sudo systemctl start termfleet
sudo systemctl stop termfleet
sudo systemctl restart termfleet
sudo systemctl status termfleet

# View logs
sudo journalctl -u termfleet -f                    # Follow live logs
sudo journalctl -u termfleet -n 100                # Last 100 lines
tail -f /opt/termfleet/logs/error.log | jq '.'    # Errors only

# Database
sqlite3 /opt/termfleet/data/termfleet.db           # Connect to DB
sqlite3 /opt/termfleet/data/termfleet.db "SELECT * FROM workstations;"

# API calls
curl https://termfleet.yourdomain.com/health                    # Health check
curl https://termfleet.yourdomain.com/api/workstations | jq -   # List workstations

# Backup
/opt/termfleet/scripts/backup-db.sh                # Manual backup

# Maintenance
sqlite3 /opt/termfleet/data/termfleet.db "VACUUM; ANALYZE;"     # Optimize DB
```

---

**Document Version:** 1.0  
**Maintained by:** Termfleet Operations Team
