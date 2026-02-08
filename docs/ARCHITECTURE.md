# Termfleet Architecture

**Version:** 1.0  
**Last Updated:** February 8, 2026

## System Overview

Termfleet is a centralized management system for monitoring and accessing ttyd-based web terminals across multiple workstations. It combines automatic registration, DNS management, health monitoring, and a real-time dashboard.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TERMFLEET SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         HTTPS/443           ┌──────────────────────┐
│                  │◄────────────────────────────►│   WORKSTATION #1     │
│   End Users      │                              │  ┌─────────────────┐ │
│  (Browsers)      │                              │  │  ttyd :7681     │ │
│                  │                              │  │  (web terminal) │ │
└────────┬─────────┘                              │  └─────────────────┘ │
         │                                        │  ┌─────────────────┐ │
         │                                        │  │ Registration    │ │
         │ HTTPS/443                              │  │ Service         │ │
         │ (Dashboard & API)                      │  └────────┬────────┘ │
         ▼                                        └───────────┼──────────┘
┌────────────────────┐                                       │ POST /register
│                    │                                       │ (on boot)
│   Nginx Reverse    │                                       │
│   Proxy            │                   ┌───────────────────▼────────────┐
│   (Port 80/443)    │                   │   WORKSTATION #2               │
│                    │                   │  ┌─────────────────┐           │
└──────────┬─────────┘                   │  │  ttyd :7681     │           │
           │                             │  └─────────────────┘           │
           │ Proxies to                  │  ┌─────────────────┐           │
           │ localhost:3000              │  │ Registration    │           │
           ▼                             │  │ Service         │           │
┌──────────────────────────────────┐    │  └─────────────────┘           │
│    TERMFLEET NODE.JS SERVER      │    └────────────────────────────────┘
│        (Port 3000)                │                   │
│                                   │                   │ POST /register
│  ┌────────────────────────────┐  │                   │
│  │  Express.js                │  │◄──────────────────┘
│  │  - REST API Endpoints      │  │
│  │  - Static File Serving     │  │
│  │  - Rate Limiting           │  │              ┌──────────────────────┐
│  │  - Request Logging         │  │              │   WORKSTATION #N     │
│  └────────────┬───────────────┘  │              │  ┌─────────────────┐ │
│               │                   │              │  │  ttyd :7681     │ │
│  ┌────────────▼───────────────┐  │              │  └─────────────────┘ │
│  │  Routes                    │  │              │  ┌─────────────────┐ │
│  │  - /health                 │  │              │  │ Registration    │ │
│  │  - /api/workstations/*     │  │              │  │ Service         │ │
│  └────────────┬───────────────┘  │              │  └─────────────────┘ │
│               │                   │              └───────────┬──────────┘
│  ┌────────────▼───────────────┐  │                          │
│  │  Services Layer            │  │                          │
│  │  ┌──────────────────────┐  │  │                          │
│  │  │ State Machine        │  │  │                          │
│  │  │ - Apply transitions  │  │  │                          │
│  │  │ - Cleanup logic      │  │  │                          │
│  │  └──────────────────────┘  │  │                          │
│  │  ┌──────────────────────┐  │  │                          │
│  │  │ Spaceship DNS        │  │  │                          │
│  │  │ - Create A records   │  │  │◄─────────────────────────┘
│  │  │ - Check propagation  │  │  │   Registration requests
│  │  └──────────────────────┘  │  │
│  └────────────┬───────────────┘  │
│               │                   │
│  ┌────────────▼───────────────┐  │   HTTP :7681
│  │  Health Check Job          │  ├──────────────────────────┐
│  │  - Runs every 20 seconds   │  │                          │
│  │  - Checks all workstations │  │──────┐                   │
│  │  - Updates state machine   │  │      │ Parallel health   │
│  └────────────┬───────────────┘  │      │ checks to all     │
│               │                   │      │ workstations      │
│  ┌────────────▼───────────────┐  │◄─────┘                   │
│  │  Database Layer (SQLite)   │  │                          │
│  │  - workstations table      │  │                          │
│  │  - workstation_events      │  │                          │
│  └────────────────────────────┘  │                          │
│                                   │                          │
│  ┌────────────────────────────┐  │                          │
│  │  Winston Logger            │  │                          │
│  │  - File rotation           │  │                          │
│  │  - JSON format             │  │                          │
│  └────────────────────────────┘  │                          │
│                                   │                          │
│  ┌────────────────────────────┐  │                          │
│  │  React Frontend (SPA)      │  │                          │
│  │  Built with Vite           │  │                          │
│  │  Served from dist/client/  │  │                          │
│  └────────────────────────────┘  │                          │
└───────────────────────────────────┘                          │
                                                               │
┌──────────────────────────────────────────────────────────────▼──┐
│                  SPACESHIP.COM DNS API                           │
│                  (HTTPS API)                                     │
│  - Create/Update A records                                       │
│  - DNS zone management                                           │
│  - TTL: 10 minutes                                               │
└──────────────────────────────────────────────────────────────────┘

External Domain: ws.aprender.cloud
```

---

## Component Breakdown

### 1. Workstations

**Purpose:** Remote machines running ttyd web terminals

**Components:**
- **ttyd**: Web-based terminal on port 7681
- **Registration Service**: systemd service that runs on boot
  - Script: `/usr/local/bin/register-termfleet.sh`
  - Service: `/etc/systemd/system/termfleet-registration.service`
  - Sends: `POST /api/workstations/register` with name and IP

**Lifecycle:**
```
Boot → Registration Service Starts → Sends POST to Termfleet
     → Termfleet creates DNS record → Health checks begin
     → ttyd detected → Status: online
```

### 2. Nginx Reverse Proxy

**Purpose:** SSL termination, HTTPS, routing

**Configuration:**
- Listens: Port 80 (redirect to HTTPS), Port 443 (HTTPS)
- SSL/TLS: Let's Encrypt certificates
- Proxies: All requests to `http://localhost:3000` (Node.js)
- Security Headers: HSTS, X-Frame-Options, CSP
- Static Asset Caching: 30 days for JS/CSS/images

**Benefits:**
- SSL/TLS offloading
- Security hardening
- Better performance for static assets
- Professional HTTPS setup

### 3. Node.js Express Server

#### 3.1 HTTP Layer

**Port:** 3000 (localhost only, behind Nginx)

**Middleware:**
- `express.json()` - Parse JSON bodies
- `cors()` - CORS headers
- `rateLimit()` - Max 100 requests/minute per IP
- `requestLogger` - Log all requests with UUID
- `errorHandler` - Catch errors, format responses

**Static Serving:**
- Serves React SPA from `dist/client/`
- Catch-all route returns `index.html` for client-side routing

#### 3.2 API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health check |
| `/api/workstations/register` | POST | Register new workstation |
| `/api/workstations/:name/propagation` | GET | Check DNS propagation |
| `/api/workstations` | GET | List all (with filters/sort) |
| `/api/workstations/:name` | GET | Get single workstation |

#### 3.3 Services Layer

**State Machine Service:**
```typescript
// Defines state transitions and timing rules
STATE_TRANSITIONS = {
  starting: { timeout: 10 * 60 * 1000, nextState: 'unknown' },
  online: { timeout: 1 * 60 * 1000, nextState: 'unknown' },
  unknown: { timeout: 10 * 60 * 1000, nextState: 'terminated' }
}

// Core function: applyStateMachine(workstation, healthCheckPassed)
// Returns: { status, reason, remove }
```

**Spaceship DNS Service:**
- `registerOrUpdateDNS(name, ipAddress)` - Create/update A record
- `checkPropagation(name, expectedIp)` - Verify DNS resolves correctly
- Uses Spaceship.com REST API with API key/secret authentication

#### 3.4 Health Check Job

**Scheduler:**
```typescript
setInterval(async () => {
  const workstations = db.getAllWorkstations();
  
  await Promise.all(workstations.map(async (ws) => {
    const healthCheckPassed = await checkWorkstation(ws);
    const newState = applyStateMachine(ws, healthCheckPassed);
    db.updateWorkstation(newState);
    logEvent(ws, newState);
  }));
}, 20000); // Every 20 seconds
```

**Health Check Logic:**
```typescript
async function checkWorkstation(ws) {
  try {
    const response = await fetch(`http://${ws.ip_address}:7681/`, {
      timeout: 10000
    });
    return response.ok; // true if 200-299
  } catch (error) {
    return false;
  }
}
```

**Parallel Execution:** Checks all workstations simultaneously for speed

#### 3.5 Database Layer (SQLite)

**File:** `termfleet.db` (by default)

**Schema:**

```sql
-- Workstations
CREATE TABLE workstations (
  name TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  status TEXT NOT NULL,
  -- Timestamps
  created_at TEXT NOT NULL,
  last_check TEXT,
  unknown_since TEXT,
  terminated_at TEXT,
  -- DNS
  dns_failed BOOLEAN DEFAULT 0,
  dns_error TEXT,
  -- Termination
  terminated_reason TEXT
);

-- Events (audit log)
CREATE TABLE workstation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workstation_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (workstation_name) REFERENCES workstations(name)
);
```

**Indexes:**
- `idx_workstations_status` on `status`
- `idx_workstations_created_at` on `created_at`
- `idx_events_workstation` on `workstation_name`
- `idx_events_timestamp` on `timestamp`

**Operations:**
- All queries use `better-sqlite3` (synchronous, fast)
- WAL mode enabled for better concurrency
- Transactions used for multi-step operations

#### 3.6 Logging (Winston)

**Log Files:**
- `logs/combined.log` - All levels
- `logs/error.log` - Errors only

**Format:** JSON with timestamp, level, message, metadata

**Rotation:**
- Max size: 10MB per file
- Max files: 5
- Old files compressed (gzipped)

**What's Logged:**
- HTTP requests (method, URL, status, duration)
- Database operations (inserts, updates)
- Health check results
- State transitions
- DNS operations
- Errors with stack traces

**What's NOT Logged:**
- API keys/secrets
- Sensitive user data

### 4. React Frontend

**Built with:**
- React 18
- TypeScript
- Mantine UI
- Vite (build tool)

**Pages:**
- **Dashboard** (`/`)
  - Workstation cards with status badges
  - Summary statistics
  - Filters and sorting
  - Auto-refresh every 5 seconds

**Components:**
- `WorkstationCard` - Individual workstation display
- `WorkstationFilters` - Status filter and sort controls
- `WorkstationSummary` - Count badges (total, online, etc.)

**API Client:**
- Uses `fetch()` for API calls
- Polling: `useEffect` with 5-second interval
- Error handling and loading states

**Build Output:**
- Production bundle in `dist/client/`
- Code splitting, minification, tree-shaking
- Served by Node.js express static middleware

### 5. Spaceship.com DNS Integration

**Purpose:** Automatic subdomain creation

**API Endpoints Used:**
- `POST /v1/dns/records` - Create A record
- `PATCH /v1/dns/records/:id` - Update A record
- `GET /v1/dns/records` - List records

**Authentication:**
```http
X-API-Key: <SPACESHIP_API_KEY>
X-API-Secret: <SPACESHIP_API_SECRET>
```

**Record Created:**
```json
{
  "type": "A",
  "name": "desk1",
  "content": "192.168.1.100",
  "ttl": 600,
  "zone": "ws.aprender.cloud"
}
```

**Result:** `desk1.ws.aprender.cloud` → `192.168.1.100`

---

## Data Flow Diagrams

### Registration Flow

```
┌──────────────┐
│ Workstation  │
│ Boots        │
└──────┬───────┘
       │
       │ systemd service starts
       ▼
┌──────────────────────────┐
│ Registration Script      │
│ - Detect network         │
│ - Get IP address         │
│ - Get hostname           │
└──────┬───────────────────┘
       │
       │ POST /api/workstations/register
       │ { "name": "desk1", "ip": "192.168.1.100" }
       ▼
┌──────────────────────────────────────┐
│ Termfleet API                        │
│ 1. Validate input                    │
│ 2. Check if already exists           │
│ 3. Call Spaceship DNS service        │
└──────┬───────────────────────────────┘
       │
       │ Create A record
       ▼
┌──────────────────────────────────────┐
│ Spaceship.com API                    │
│ Creates: desk1.ws.aprender.cloud     │
│          → 192.168.1.100             │
└──────┬───────────────────────────────┘
       │
       │ Success
       ▼
┌──────────────────────────────────────┐
│ Termfleet Database                   │
│ INSERT INTO workstations             │
│ - name: desk1                        │
│ - ip_address: 192.168.1.100          │
│ - domain_name: desk1.ws...           │
│ - status: starting                   │
│ - created_at: now()                  │
└──────┬───────────────────────────────┘
       │
       │ INSERT INTO workstation_events
       │ (event_type: 'registered')
       ▼
┌──────────────────────────────────────┐
│ Response to Workstation              │
│ HTTP 201 Created                     │
│ {                                    │
│   "success": true,                   │
│   "data": { ... }                    │
│ }                                    │
└──────────────────────────────────────┘
```

### Health Check Flow

```
┌─────────────────────────────┐
│ Health Check Timer Fires    │
│ (Every 20 seconds)          │
└──────┬──────────────────────┘
       │
       │ Fetch all workstations from DB
       ▼
┌─────────────────────────────────────┐
│ For Each Workstation (Parallel):   │
│ 1. desk1 → http://IP:7681/         │
│ 2. desk2 → http://IP:7681/         │
│ 3. desk3 → http://IP:7681/         │
│ ... (timeout: 10 seconds)           │
└──────┬──────────────────────────────┘
       │
       │ Results: [true, false, true, ...]
       ▼
┌─────────────────────────────────────┐
│ Apply State Machine Logic           │
│                                     │
│ desk1 (starting, passed)            │
│   → Transition to 'online'          │
│                                     │
│ desk2 (online, failed, 1 min)       │
│   → Transition to 'unknown'         │
│                                     │
│ desk3 (unknown, passed)             │
│   → Transition back to 'online'     │
│                                     │
│ desk4 (unknown, failed, 10 min)     │
│   → Transition to 'terminated'      │
│                                     │
│ desk5 (terminated, 50 min)          │
│   → Remove from database            │
└──────┬──────────────────────────────┘
       │
       │ UPDATE workstations
       │ INSERT INTO workstation_events
       ▼
┌─────────────────────────────────────┐
│ Database Updated                    │
│ - status changed                    │
│ - last_check updated                │
│ - events logged                     │
└─────────────────────────────────────┘
       │
       │ Next cycle in 20 seconds
       └──────────────────────────────►
```

### Dashboard Refresh Flow

```
┌──────────────────┐
│ Browser          │
│ Opens Dashboard  │
└──────┬───────────┘
       │
       │ GET / → index.html
       ▼
┌──────────────────────────────┐
│ React App Loads              │
│ useEffect(() => { ... }, []) │
└──────┬───────────────────────┘
       │
       │ GET /api/workstations
       ▼
┌──────────────────────────────────────┐
│ Termfleet API                        │
│ SELECT * FROM workstations           │
│ WHERE status != 'removed'            │
│ ORDER BY created_at DESC             │
└──────┬───────────────────────────────┘
       │
       │ Returns JSON array
       ▼
┌──────────────────────────────────────┐
│ React State Updated                  │
│ setWorkstations(data)                │
│ Re-render WorkstationCard components │
└──────┬───────────────────────────────┘
       │
       │ User sees dashboard
       │
       │ Wait 5 seconds
       ▼
┌──────────────────────────────────────┐
│ Auto-Refresh Timer                   │
│ setTimeout(() => refetch(), 5000)    │
└──────┬───────────────────────────────┘
       │
       │ Loop continues
       └──────────────────────────────►
```

---

## State Machine Diagram

```
                    ┌─────────────┐
                    │  STARTING   │ (Yellow)
                    └──────┬──────┘
                           │
                ┌──────────┼──────────┐
                │                     │
        Health check                Health check fails
        succeeds                    for 10 minutes
                │                     │
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │   ONLINE    │       │   UNKNOWN   │ (Red)
         └──────┬──────┘       └──────┬──────┘
                │                     │
                │                     │
      Health check fails     ┌────────┼────────┐
      for 1 minute           │                 │
                │            │          Health check fails
                │            │          for 10 minutes
                │            │                 │
                └────────────┤                 │
                             │                 │
                             ▼                 ▼
                      ┌─────────────┐   ┌──────────────┐
                      │   UNKNOWN   │   │  TERMINATED  │ (Gray)
                      └──────┬──────┘   └──────┬───────┘
                             │                 │
                    Health check              │
                    succeeds                  │
                    (recovery)                │
                             │            50 minutes pass
                             │                 │
                             │                 ▼
                             │          ┌─────────────┐
                             └────────► │   REMOVED   │
                                        └─────────────┘
                                        (deleted from DB)

State Colors:
- Starting: Yellow
- Online: Green
- Unknown: Red
- Terminated: Gray
- Removed: (not displayed)

Timing Rules:
- starting → unknown: 10 minutes timeout
- online → unknown: 1 minute timeout
- unknown → terminated: 10 minutes timeout
- terminated → removed: 50 minutes after termination
- unknown → online: Immediate (recovery)
```

---

## Security Architecture

### Authentication & Authorization

**Current:** No authentication (internal network assumed)

**Rate Limiting:**
- 100 requests/minute per IP address
- Applied to all endpoints
- Returns HTTP 429 on exceeded

### Input Validation

**Workstation Name:**
- Pattern: `^[a-zA-Z0-9-]+$` (alphanumeric + hyphens)
- Length: 1-63 characters
- No SQL injection risk (parameterized queries)

**IP Address:**
- IPv4 format validation: `^(\d{1,3}\.){3}\d{1,3}$`
- Each octet: 0-255

**Future Enhancements:**
- API key authentication for registration endpoint
- JWT tokens for dashboard access
- Role-based access control (RBAC)

### Network Security

**Firewall Rules:**
- Inbound: Only 80, 443 open (Nginx)
- Nginx → Node.js: localhost only
- Node.js → Workstations: Port 7681 outbound
- Node.js → Spaceship: Port 443 outbound

**HTTPS:**
- Let's Encrypt SSL certificates
- TLS 1.2, 1.3 only
- Strong cipher suites

**Headers:**
- HSTS: `max-age=31536000`
- X-Frame-Options: `SAMEORIGIN`
- X-Content-Type-Options: `nosniff`
- X-XSS-Protection: `1; mode=block`

### Database Security

- SQLite file permissions: `640` (owner read/write only)
- No remote access (file-based)
- Prepared statements (no SQL injection)
- No sensitive data stored (IP addresses only)

### Secrets Management

**Environment Variables:**
- `.env` file with `600` permissions
- Not committed to version control
- Spaceship API keys stored here

---

## Scalability Considerations

### Current Limits

- **Workstations:** Tested up to 20, designed for 25
- **Health Check:** Sequential HTTP requests take ~10-50ms each
  - 20 workstations × 50ms = 1 second per cycle
  - Runs every 20 seconds, so 5% CPU time
- **Database:** SQLite suitable for <100k records, single writer

### Scaling Strategies

**Horizontal (Future):**
- Multiple Termfleet instances with shared database ( switch to PostgreSQL)
- Load balancer in front
- Workstation partitioning by region

**Vertical (Current):**
- Increase health check interval (`WORKSTATION_CHECK_INTERVAL=30000`)
- Reduce timeout (`WORKSTATION_CHECK_TIMEOUT=5000`)
- More CPU/RAM on server

**Database:**
- Consider PostgreSQL for >50 workstations
- Or MySQL for better concurrency
- Redis cache for frequently accessed data

---

## Technology Choices

| Component | Technology | Reason |
|-----------|------------|--------|
| Backend | Node.js + Express | Fast, async I/O, large ecosystem |
| Language | TypeScript | Type safety, better DX |
| Database | SQLite | Simple, serverless, sufficient for scale |
| Frontend | React | Popular, component-based, large community |
| UI Library | Mantine | Modern, TypeScript-first, comprehensive |
| Build Tool | Vite | Fast HMR, modern, great DX |
| Logging | Winston | Flexible, file rotation, JSON format |
| DNS | Spaceship.com API | Simple REST API, good docs |
| Process Mgmt | systemd | Native, reliable, logs to journald |
| Reverse Proxy | Nginx | Industry standard, fast, secure |

---

## Monitoring & Observability

### Metrics Available

**Health Endpoint (`/health`):**
```json
{
  "status": "ok",
  "timestamp": "ISO-8601",
  "uptime": <seconds>,
  "database": "ok"
}
```

**Logs:**
- Structured JSON format
- Request IDs for tracing
- Duration metrics (response time)
- Error stack traces

**Database Queries:**
```sql
-- Workstations by status
SELECT status, COUNT(*) FROM workstations GROUP BY status;

-- Average time in each state
SELECT status, AVG(julianday('now') - julianday(created_at)) * 24 as hours
FROM workstations GROUP BY status;

-- Recent state changes
SELECT * FROM workstation_events
WHERE event_type = 'state_change'
ORDER BY timestamp DESC LIMIT 10;
```

**Future: Prometheus Integration**
- Expose `/metrics` endpoint
- Grafana dashboards
- Alerting rules

---

## Disaster Recovery

### Backup

**Database:**
- Automated daily backups (cron job)
- Compressed gzip files
- Retained for 30 days
- Stored in `/opt/termfleet/backups/`

**Configuration:**
- `.env` file backed up separately
- Service files in version control

### Recovery Procedures

**Database Corruption:**
1. Stop service
2. Restore from latest backup
3. Start service
4. Verify health

**Server Failure:**
1. Provision new server
2. Install Termfleet (see [DEPLOYMENT.md](DEPLOYMENT.md))
3. Restore database from backup
4. Update DNS to point to new server
5. Workstations will re-register on next boot

**DNS Provider Outage:**
- Workstations remain accessible by IP
- Registration temporarily fails
- Auto-recovers when DNS API back online

---

## Future Enhancements

### Short-Term
- [ ] Add Vitest for unit testing
- [ ] WebSocket for real-time dashboard updates (instead of polling)
- [ ] Prometheus metrics endpoint
- [ ] API authentication (API keys)

### Medium-Term
- [ ] Multi-region support (workstation grouping)
- [ ] PostgreSQL option for large deployments
- [ ] Docker containerization
- [ ] Kubernetes deployment manifests

### Long-Term
- [ ] User authentication and multi-tenancy
- [ ] Workstation groups and tagging
- [ ] Historical analytics (uptime %, avg response time)
- [ ] Mobile app
- [ ] Auto-scaling health check workers

---

## Appendix: File Structure

```
termfleet/
├── src/
│   ├── server/
│   │   ├── index.ts              # Entry point
│   │   ├── config.ts             # Environment config
│   │   ├── logger.ts             # Winston setup
│   │   ├── db/
│   │   │   └── database.ts       # SQLite operations
│   │   ├── routes/
│   │   │   ├── health.ts         # Health check endpoint
│   │   │   └── workstations.ts   # Workstation endpoints
│   │   ├── services/
│   │   │   ├── spaceship.ts      # DNS integration
│   │   │   └── stateMachine.ts   # State transitions
│   │   ├── jobs/
│   │   │   └── healthCheck.ts    # Scheduled health job
│   │   ├── middleware/
│   │   │   ├── rateLimit.ts      # Rate limiting
│   │   │   ├── requestLogger.ts  # Request logging
│   │   │   └── errorHandler.ts   # Error handling
│   │   └── utils/
│   │       ├── validation.ts     # Input validation
│   │       └── apiResponse.ts    # Response formatting
│   ├── client/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Root component
│   │   ├── pages/
│   │   │   └── Dashboard.tsx     # Main dashboard
│   │   ├── components/
│   │   │   ├── WorkstationCard.tsx
│   │   │   ├── WorkstationFilters.tsx
│   │   │   └── WorkstationSummary.tsx
│   │   └── services/
│   │       └── api.ts            # API client functions
│   └── shared/
│       └── types.ts              # Shared TypeScript types
├── docs/
│   ├── SPEC.md                   # Full specification
│   ├── PLAN.md                   # Implementation roadmap
│   ├── LOGGING_REVIEW.md         # Logging audit
│   ├── TEST_PLAN.md              # Testing procedures
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── OPERATIONS.md             # Operations guide
│   └── ARCHITECTURE.md           # This document
├── dist/                         # Build output
│   ├── client/                   # Frontend bundle
│   └── server/                   # Compiled TypeScript
├── logs/                         # Application logs
│   ├── combined.log
│   └── error.log
├── data/                         # Database files
│   └── termfleet.db
├── schema.sql                    # Database schema
├── package.json                  # NPM dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
└── .env                          # Environment variables
```

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026  
**Maintained by:** Termfleet Development Team
