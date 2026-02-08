# Termfleet Production Deployment Guide

**Version:** 1.0  
**Last Updated:** February 8, 2026

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Installation Steps](#installation-steps)
4. [Configuration](#configuration)
5. [Database Setup](#database-setup)
6. [Building for Production](#building-for-production)
7. [Process Management](#process-management)
8. [Reverse Proxy Setup](#reverse-proxy-setup)
9. [SSL/TLS Configuration](#ssltls-configuration)
10. [Monitoring](#monitoring)
11. [Backup Strategy](#backup-strategy)
12. [Updates & Maintenance](#updates--maintenance)

---

## Prerequisites

### Required Software

- **Operating System**: Ubuntu 22.04+ LTS or Debian 11+ (recommended)
- **Node.js**: Version 18.x or 20.x LTS
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For cloning repository
- **SQLite3**: Built into Node.js, but CLI useful for management

### Required Services

- **Spaceship.com Account**: With API credentials
- **Domain**: `ws.aprender.cloud` (or your base domain) configured in Spaceship

### Optional but Recommended

- **Nginx**: For reverse proxy
- **Certbot**: For Let's Encrypt SSL certificates
- **logrotate**: For additional log management (if system-managed)

---

## Server Requirements

### Minimum Specifications

- **CPU**: 1 vCPU
- **RAM**: 1 GB
- **Disk**: 10 GB (with room for logs and database growth)
- **Network**: Public IP with inbound ports 80/443 open

### Recommended Specifications

For 20-25 concurrent workstations:

- **CPU**: 2 vCPU
- **RAM**: 2 GB
- **Disk**: 20 GB SSD
- **Network**: Low-latency connection, 100 Mbps+

### Firewall Requirements

**Inbound:**
- Port 80 (HTTP) - For Let's Encrypt validation
- Port 443 (HTTPS) - For web access
- Port 22 (SSH) - For management (restrict to admin IPs)

**Outbound:**
- Port 443 (HTTPS) - For Spaceship.com API calls
- Port 53 (DNS) - For DNS resolution
- Port 7681 (HTTP) - For workstation health checks

---

## Installation Steps

### 1. Create Dedicated User

```bash
# Create termfleet user
sudo useradd -r -s /bin/bash -d /opt/termfleet -m termfleet

# Switch to termfleet user
sudo su - termfleet
```

### 2. Clone Repository

```bash
cd /opt/termfleet
git clone https://github.com/your-org/termfleet.git .

# Or download specific release
git fetch --tags
git checkout v1.0.0
```

### 3. Install Node.js Dependencies

```bash
npm install --production

# Verify installation
npm list --depth=0
```

### 4. Install Global Tools (Optional)

```bash
# As root or with sudo
sudo npm install -g pm2
```

---

## Configuration

### 1. Create Environment File

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Production Environment Variables

```env
# === Required Configuration ===

NODE_ENV=production
PORT=3000

# Spaceship.com API credentials
SPACESHIP_API_KEY=your_actual_api_key_here
SPACESHIP_API_SECRET=your_actual_api_secret_here

# Base domain for workstations
BASE_DOMAIN=ws.aprender.cloud

# === Optional - Recommended Changes ===

# Database
DATABASE_PATH=/opt/termfleet/data/termfleet.db

# Logging
LOG_LEVEL=info
LOG_FILE=/opt/termfleet/logs/combined.log
ERROR_LOG_FILE=/opt/termfleet/logs/error.log

# DNS
DNS_TTL=600

# Health checks
WORKSTATION_CHECK_INTERVAL=20000
WORKSTATION_CHECK_TIMEOUT=10000

# Security
MAX_REQUESTS_PER_MINUTE=100
CORS_ORIGIN=https://termfleet.yourdomain.com

# === Optional - Defaults Usually Fine ===

# Spaceship API base URL (change only if different)
# SPACESHIP_BASE_URL=https://api.spaceship.com

# Health check port (change only if workstations use different port)
# WORKSTATION_PORT=7681
```

### 3. Create Required Directories

```bash
mkdir -p /opt/termfleet/data
mkdir -p /opt/termfleet/logs

# Set permissions
chmod 755 /opt/termfleet/data
chmod 755 /opt/termfleet/logs
```

### 4. Secure Environment File

```bash
chmod 600 .env
chown termfleet:termfleet .env
```

---

## Database Setup

### 1. Initialize Database

The database is automatically created on first run, but you can pre-initialize:

```bash
# As termfleet user
cd /opt/termfleet
sqlite3 data/termfleet.db < schema.sql
```

### 2. Enable WAL Mode (Recommended)

Write-Ahead Logging improves concurrent access:

```bash
sqlite3 data/termfleet.db "PRAGMA journal_mode=WAL;"
```

### 3. Verify Schema

```bash
sqlite3 data/termfleet.db ".schema"
```

Expected output:
```sql
CREATE TABLE workstations (...);
CREATE TABLE workstation_events (...);
CREATE INDEX idx_workstations_status ON workstations(status);
CREATE INDEX idx_workstations_created_at ON workstations(created_at);
CREATE INDEX idx_events_workstation ON workstation_events(workstation_name);
CREATE INDEX idx_events_timestamp ON workstation_events(timestamp);
```

---

## Building for Production

### 1. Build Frontend and Backend

```bash
cd /opt/termfleet
npm run build
```

This creates:
- `dist/client/` - React frontend bundle
- `dist/server/` - Compiled TypeScript server

### 2. Verify Build

```bash
# Check dist directories exist
ls -la dist/
ls -la dist/client/
ls -la dist/server/

# Test server starts
NODE_ENV=production node dist/server/index.js
# Press Ctrl+C after verifying it starts
```

### 3. Production Build Checklist

- [ ] `dist/client/index.html` exists
- [ ] `dist/client/assets/` contains JS/CSS bundles
- [ ] `dist/server/index.js` exists
- [ ] No build errors or warnings
- [ ] `.env` file configured correctly

---

## Process Management

### Option 1: systemd (Recommended)

#### Create Service File

```bash
sudo nano /etc/systemd/system/termfleet.service
```

**Service file contents:**
```ini
[Unit]
Description=Termfleet - Web Terminal Fleet Management
Documentation=https://github.com/your-org/termfleet
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=termfleet
Group=termfleet
WorkingDirectory=/opt/termfleet

# Load environment variables
EnvironmentFile=/opt/termfleet/.env

# Start command
ExecStart=/usr/bin/node dist/server/index.js

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=120

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=termfleet

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/termfleet/data /opt/termfleet/logs

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable termfleet

# Start service
sudo systemctl start termfleet

# Check status
sudo systemctl status termfleet

# View logs
sudo journalctl -u termfleet -f
```

#### Service Management Commands

```bash
# Start
sudo systemctl start termfleet

# Stop
sudo systemctl stop termfleet

# Restart
sudo systemctl restart termfleet

# Reload config (restart)
sudo systemctl reload termfleet

# Check status
sudo systemctl status termfleet

# View logs (last 100 lines)
sudo journalctl -u termfleet -n 100

# Follow logs in real-time
sudo journalctl -u termfleet -f
```

### Option 2: PM2

PM2 is a production process manager for Node.js with built-in load balancing.

#### Install PM2

```bash
sudo npm install -g pm2
```

#### Create Ecosystem File

```bash
nano ecosystem.config.js
```

**Ecosystem file contents:**
```javascript
module.exports = {
  apps: [{
    name: 'termfleet',
    script: './dist/server/index.js',
    cwd: '/opt/termfleet',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: '/opt/termfleet/logs/pm2-error.log',
    out_file: '/opt/termfleet/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

#### Start with PM2

```bash
# Start
pm2 start ecosystem.config.js --env production

# Save process list
pm2 save

# Setup startup script
pm2 startup systemd -u termfleet --hp /opt/termfleet

# List processes
pm2 list

# Monitor
pm2 monit

# View logs
pm2 logs termfleet
```

#### PM2 Management Commands

```bash
# Restart
pm2 restart termfleet

# Stop
pm2 stop termfleet

# Delete from PM2
pm2 delete termfleet

# View details
pm2 describe termfleet
```

---

## Reverse Proxy Setup

### Nginx Configuration

#### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

#### 2. Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/termfleet
```

**Configuration:**
```nginx
# Upstream Node.js server
upstream termfleet_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name termfleet.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name termfleet.yourdomain.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/termfleet.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/termfleet.yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/termfleet-access.log;
    error_log /var/log/nginx/termfleet-error.log;

    # Max upload size
    client_max_body_size 10M;

    # Proxy to Node.js
    location / {
        proxy_pass http://termfleet_backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable cache for API
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://termfleet_backend;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/termfleet /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Let's Encrypt with Certbot

#### 1. Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

#### 2. Obtain Certificate

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone \
  -d termfleet.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Start Nginx
sudo systemctl start nginx
```

#### 3. Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is enabled by default via systemd timer
sudo systemctl status certbot.timer
```

#### 4. Renewal Hook (Optional)

Create `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`:

```bash
#!/bin/bash
systemctl reload nginx
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Monitoring

### Application Logs

#### Winston Logs

```bash
# View combined log
tail -f /opt/termfleet/logs/combined.log

# View error log only
tail -f /opt/termfleet/logs/error.log

# Filter errors from combined log
cat /opt/termfleet/logs/combined.log | jq 'select(.level=="error")'
```

#### systemd Journal

```bash
# View all logs
sudo journalctl -u termfleet

# Follow logs
sudo journalctl -u termfleet -f

# Today's logs
sudo journalctl -u termfleet --since today

# Last hour
sudo journalctl -u termfleet --since "1 hour ago"

# Filter by priority (errors only)
sudo journalctl -u termfleet -p err
```

### Health Check Monitoring

#### Manual Health Check

```bash
curl https://termfleet.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-08T12:00:00.000Z",
  "uptime": 3600,
  "database": "ok"
}
```

#### Automated Monitoring with Uptime Kuma

1. Install [Uptime Kuma](https://github.com/louislam/uptime-kuma)
2. Add HTTP(s) monitor for `/health` endpoint
3. Configure alerts (email, Slack, Discord)

#### Simple Cron Health Check

```bash
# Add to crontab
crontab -e
```

```cron
*/5 * * * * curl -f https://termfleet.yourdomain.com/health || echo "Termfleet health check failed" | mail -s "Termfleet Alert" admin@example.com
```

### Resource Monitoring

```bash
# Check process status
ps aux | grep node

# Check memory usage
free -h

# Check disk usage
df -h /opt/termfleet

# Check database size
du -h /opt/termfleet/data/termfleet.db
```

---

## Backup Strategy

### Database Backups

#### Automated Daily Backup Script

Create `/opt/termfleet/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/termfleet/backups"
DB_PATH="/opt/termfleet/data/termfleet.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="termfleet_${TIMESTAMP}.db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "termfleet_*.db.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

```bash
# Make executable
chmod +x /opt/termfleet/scripts/backup-db.sh

# Test backup
/opt/termfleet/scripts/backup-db.sh
```

#### Schedule with Cron

```bash
# Edit crontab as termfleet user
crontab -e
```

```cron
# Daily backup at 2 AM
0 2 * * * /opt/termfleet/scripts/backup-db.sh >> /opt/termfleet/logs/backup.log 2>&1
```

### Configuration Backups

```bash
# Backup .env file
cp /opt/termfleet/.env /opt/termfleet/backups/env.$(date +%Y%m%d).bak

# Store off-site (e.g., S3, rsync to backup server)
```

### Restore Procedure

#### Restore Database

```bash
# Stop service
sudo systemctl stop termfleet

# Backup current database
mv /opt/termfleet/data/termfleet.db /opt/termfleet/data/termfleet.db.old

# Extract and restore backup
gunzip -c /opt/termfleet/backups/termfleet_20260208_020000.db.gz > /opt/termfleet/data/termfleet.db

# Start service
sudo systemctl start termfleet

# Verify
sudo systemctl status termfleet
```

---

## Updates & Maintenance

### Updating Termfleet

#### 1. Backup Before Update

```bash
# Backup database
/opt/termfleet/scripts/backup-db.sh

# Backup current code
cp -r /opt/termfleet /opt/termfleet.backup.$(date +%Y%m%d)
```

#### 2. Pull Latest Code

```bash
cd /opt/termfleet

# Fetch updates
git fetch origin

# View changes
git log HEAD..origin/main --oneline

# Pull updates
git pull origin main

# Or checkout specific version
git checkout v1.1.0
```

#### 3. Install Dependencies

```bash
npm install --production
```

#### 4. Rebuild Application

```bash
npm run build
```

#### 5. Restart Service

```bash
sudo systemctl restart termfleet

# Monitor logs for errors
sudo journalctl -u termfleet -f
```

#### 6. Verify Update

```bash
# Check health endpoint
curl https://termfleet.yourdomain.com/health

# Check dashboard loads
curl -I https://termfleet.yourdomain.com/

# Check version (if /version endpoint added)
curl https://termfleet.yourdomain.com/api/version
```

### Database Maintenance

#### Vacuum Database

Reclaim space from deleted records:

```bash
sqlite3 /opt/termfleet/data/termfleet.db "VACUUM;"
```

#### Analyze Database

Update query optimizer statistics:

```bash
sqlite3 /opt/termfleet/data/termfleet.db "ANALYZE;"
```

#### Check Integrity

```bash
sqlite3 /opt/termfleet/data/termfleet.db "PRAGMA integrity_check;"
```

### Log Rotation

Winston handles log rotation automatically, but you can manually rotate:

```bash
# Move current logs
mv /opt/termfleet/logs/combined.log /opt/termfleet/logs/combined.log.1
mv /opt/termfleet/logs/error.log /opt/termfleet/logs/error.log.1

# Reload service to create new logs
sudo systemctl reload termfleet
```

---

## Troubleshooting Common Issues

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u termfleet -n 50
```

**Common causes:**
- Environment file missing or incorrect permissions
- Database locked (kill stale processes)
- Port 3000 already in use
- Build files missing (run `npm run build`)

### High Memory Usage

**Check Node.js process:**
```bash
ps aux | grep node
```

**Restart service:**
```bash
sudo systemctl restart termfleet
```

**Consider setting memory limit in systemd:**
```ini
[Service]
MemoryLimit=512M
```

### Database Growing Too Large

**Check size:**
```bash
du -h /opt/termfleet/data/termfleet.db
```

**Clean old terminated workstations manually:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db "DELETE FROM workstations WHERE terminated_at < datetime('now', '-30 days');"
```

**Vacuum database:**
```bash
sqlite3 /opt/termfleet/data/termfleet.db "VACUUM;"
```

---

## Security Checklist

- [ ] `NODE_ENV=production`  set
- [ ] `.env` file has `600` permissions
- [ ] Database file has appropriate permissions (not world-readable)
- [ ] Nginx reverse proxy configured
- [ ] HTTPS enabled with valid certificate
- [ ] Security headers configured in Nginx
- [ ] Rate limiting enabled (`MAX_REQUESTS_PER_MINUTE`)
- [ ] CORS origin restricted (`CORS_ORIGIN` set to specific domain)
- [ ] Firewall configured to allow only necessary ports
- [ ] SSH access restricted to admin IPs
- [ ] Regular backups scheduled
- [ ] Log retention policy in place
- [ ] systemd hardening options enabled

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Server meets minimum specs
- [ ] Node.js 18+ installed
- [ ] Domain DNS configured
- [ ] Spaceship.com API credentials ready
- [ ] `.env` file configured
- [ ] SSL certificate obtained

### Deployment

- [ ] Repository cloned to `/opt/termfleet`
- [ ] Dependencies installed (`npm install --production`)
- [ ] Application built (`npm run build`)
- [ ] Database initialized
- [ ] systemd service created and enabled
- [ ] Nginx configured and tested
- [ ] Service started successfully

### Post-Deployment

- [ ] Health check endpoint responding
- [ ] Dashboard accessible via HTTPS
- [ ] Test workstation registration
- [ ] Verify DNS record creation
- [ ] Test workstation lifecycle (starting → online)
- [ ] Confirm logs are being written
- [ ] Monitor resource usage for 24 hours
- [ ] Set up automated backups
- [ ] Configure monitoring/alerts

---

## Support

For deployment issues:
1. Check logs: `sudo journalctl -u termfleet -n 100`
2. Review [OPERATIONS.md](OPERATIONS.md) for troubleshooting
3. Check [GitHub Issues](https://github.com/your-org/termfleet/issues)
4. Consult [README.md](../README.md) for configuration details

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026  
**Maintained by:** Termfleet Team
