# Termfleet - Comprehensive Specification

## Overview

Termfleet is a workstation management and orchestration system that complements the workstation project. It enables dynamic registration of workstations, automatic DNS routing through Spaceship.com, health monitoring, and a real-time web dashboard for tracking workstation availability and status.

### Purpose

- **Dynamic Registration**: Workstations auto-register themselves via a service/bootstrap process
- **DNS Management**: Automatic subdomain creation/updates under spaceship.com
- **Health Monitoring**: Continuous polling to track workstation availability
- **Status Visualization**: Real-time dashboard showing all tracked workstations
- **Training Environment**: Designed for trainer-managed lab environments with ~20-25 concurrent workstations

---

## Technology Stack

### Runtime & Core

- **Node.js** with ES modules
- **Express (v4.18.2)** for the server
- **TypeScript (v5.3.3)** for type-safe development
- **SQLite** with modern approach for persistent data storage

### Frontend

- **React (v18.2.0)** and React DOM
- **Vite (v7.3.1)** as build tool and dev server
- **Mantine (v7.5.0)** UI component library with hooks
- **Tabler Icons (v2.46.0)** for icons

### Backend Services

- **Spaceship.com API** for DNS management (API credentials in .env)
- **Winston** logging library with file output
- **AWS SDK clients** for EC2 and STS (future use for infrastructure)

### Development Tools

- **tsx (v4.7.0)** for running TypeScript with hot reload
- **Concurrently (v8.2.2)** for dev:server and dev:client
- Type definitions for all major dependencies

---

## Architecture

### High-Level Flow

```
Workstation (with service)
    ↓ (POST /api/workstations/register)
    ↓
Termfleet APIs
    ├→ Register workstation & create/update DNS via Spaceship
    ├→ Store workstation state in SQLite
    └→ Return domain info
    
Scheduled Job (every 20s)
    ├→ Poll all registered workstations (GET https://<domain>/health)
    ├→ Update state machine based on responses
    └→ Update SQLite with new state + timestamps
    
WebSocket / Polling
    ├→ Frontend requests workstations list
    ├→ Return current state with domain, IP, status
    └→ Display in real-time dashboard
```

---

## Data Model

### SQLite Database Schema

#### Table: `workstations`

```sql
CREATE TABLE workstations (
  id              TEXT PRIMARY KEY,                    -- UUID or name-based ID
  name            TEXT UNIQUE NOT NULL,                -- Workstation name (e.g., "desk1")
  ip_address      TEXT NOT NULL,                        -- IPv4 address (e.g., "3.3.3.3")
  domain_name     TEXT,                                 -- Full domain (e.g., "desk1.ws.aprender.cloud")
  status          TEXT NOT NULL,                        -- State: starting | online | unknown | dns_failed | terminated
  created_at      DATETIME NOT NULL,                    -- Registration timestamp
  last_check      DATETIME,                             -- Last health check timestamp
  state_changed_at DATETIME,                            -- When status last changed
  dns_error       TEXT,                                 -- If dns_failed, store error message
  
  -- State transition tracking (for timeouts)
  started_at      DATETIME,                             -- When entered "starting" state
  unknown_since   DATETIME,                             -- When entered "unknown" state
  terminated_at   DATETIME                              -- When entered "terminated" state
);

CREATE INDEX idx_status ON workstations(status);
CREATE INDEX idx_last_check ON workstations(last_check);
```

#### Table: `workstation_events` (optional, for audit trail)

```sql
CREATE TABLE workstation_events (
  id          TEXT PRIMARY KEY,
  workstation_id TEXT NOT NULL REFERENCES workstations(id),
  event_type  TEXT NOT NULL,    -- registered | status_changed | health_checked | dns_updated | dns_failed
  old_status  TEXT,
  new_status  TEXT,
  details     TEXT,             -- JSON for additional data
  timestamp   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## State Machine

### States

1. **starting**: Initial state after registration. Awaiting first successful health check or DNS propagation.
2. **online**: Workstation is responsive and reachable.
3. **unknown**: Workstation stopped responding (timeout exceeded).
4. **dns_failed**: DNS registration/update failed (new state for visibility).
5. **terminated**: Workstation marked for removal (after 10 min in "unknown").
6. **removed**: Deleted from tracking (after 50 min in "terminated").

### State Transitions

```
starting
  ├─(health check 200 OK)─→ online
  ├─(10 min timeout)─────→ unknown
  └─(DNS register fails)─→ dns_failed

online
  ├─(health check 200 OK)─→ online (refresh timestamp)
  └─(1 min no response)───→ unknown

unknown
  ├─(health check 200 OK)─→ online (auto-resume)
  ├─(10 min in unknown)───→ terminated
  └─(re-register same IP)─→ starting (restart sequence)

dns_failed
  └─(manual intervention or re-register)─→ starting

terminated
  └─(50 min in terminated)→ removed (purged from DB)
```

### Important Notes

- **Re-registration**: Can register same workstation-name with different IP without unregistering first. This resets state to "starting".
- **Tolerance**: Time calculations should be lenient with clock skew/timezone variations.
- **Automatic Recovery**: If an "unknown" workstation comes back online, it automatically transitions to "online".

---

## API Specification

### Base URL Structure

- **API Routes**: `/api/**`
- **Dashboard**: `/dashboard/**`
- **Static Assets**: `/` (served by Vite in dev, bundled in prod)

### Environment Configuration

Required in `.env`:
```
TERMFLEET_PORT=3000
TERMFLEET_BASE_DOMAIN=ws.aprender.cloud          # Subdomain base (e.g., desk1.ws.aprender.cloud)
TERMFLEET_WORKSTATION_CHECK_INTERVAL=20000       # Health check interval in ms (default: 20s)
TERMFLEET_SPACESHIP_API_KEY=<key>                # From Spaceship.com account
TERMFLEET_SPACESHIP_API_SECRET=<secret>          # From Spaceship.com account
TERMFLEET_LOG_LEVEL=debug                         # Winston log level
TERMFLEET_DB_PATH=./data/termfleet.db            # SQLite database path
TERMFLEET_RATE_LIMIT_WINDOW=900000               # Rate limit window in ms (default: 15 min)
TERMFLEET_RATE_LIMIT_MAX_REQUESTS=100            # Max requests per window per IP
TERMFLEET_HEALTH_CHECK_TIMEOUT=10000             # Health check timeout in ms (default: 10s)
```

### Endpoints

#### 1. Register Workstation

**Endpoint**: `POST /api/workstations/register`

**Request Body**:
```json
{
  "name": "desk1",
  "ip": "3.3.3.3"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "desk1",
    "name": "desk1",
    "ip_address": "3.3.3.3",
    "domain_name": "desk1.ws.aprender.cloud",
    "status": "starting",
    "created_at": "2026-02-08T10:30:00Z",
    "last_check": null
  }
}
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Invalid workstation name",
  "code": "INVALID_INPUT"
}
```

**Response (500 Internal Server Error)**:
```json
{
  "success": false,
  "error": "Failed to register DNS domain",
  "code": "DNS_REGISTRATION_FAILED",
  "details": "Spaceship API error: ..."
}
```

**Behavior**:
- If workstation name already exists with same IP: Return 200 with existing data (idempotent).
- If workstation name exists with different IP: Update IP, reset to "starting", attempt new DNS registration.
- If DNS registration fails: Set status to "dns_failed", store error message, return 500.
- Workstation service should retry on 5xx errors.

---

#### 2. Check Domain Propagation

**Endpoint**: `GET /api/workstations/:name/propagation`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "name": "desk1",
    "domain_name": "desk1.ws.aprender.cloud",
    "propagated": true,
    "checked_at": "2026-02-08T10:31:00Z"
  }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": "Workstation not found",
  "code": "NOT_FOUND"
}
```

**Behavior**:
- Query Spaceship.com API to check if domain resolves globally via standard DNS propagation check.
- If API call fails: Log error, return "propagated": false (graceful degradation).
- If Spaceship has a dedicated propagation API, use it; otherwise, perform DNS query via standard resolver.
- Always return a boolean for simplicity.

---

#### 3. List Workstations

**Endpoint**: `GET /api/workstations`

**Query Parameters**:
- `status` (optional): Filter by status (starting, online, unknown, dns_failed, terminated)
- `sort` (optional): Sort by field (name, status, created_at, last_check; default: "name")
- `order` (optional): asc | desc (default: asc)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "desk1",
      "name": "desk1",
      "ip_address": "3.3.3.3",
      "domain_name": "desk1.ws.aprender.cloud",
      "status": "online",
      "created_at": "2026-02-08T10:30:00Z",
      "last_check": "2026-02-08T10:35:20Z",
      "state_changed_at": "2026-02-08T10:31:00Z",
      "dns_error": null,
      "ttyd_url": "https://desk1.ws.aprender.cloud"
    }
  ]
}
```

**Behavior**:
- Return all registered workstations (no auth, trainer can see all).
- Include computed field `ttyd_url` for frontend convenience.
- Support filtering and sorting for dashboard UX.

---

#### 4. Health Check (Internal - Called by Job)

**Endpoint**: `GET https://<domain_name>/` (on workstation)

**Expected Response from Workstation**: 
- Status: 200 OK
- Body: Any content (ignored)

**Timeout**: 10 seconds

**Behavior**:
- Termfleet calls this internally via scheduled job.
- Health check is tolerant; 200 OK is sufficient regardless of content.
- Workstations need not have special endpoint; root responds with 200.
- For "starting" workstations: May timeout if Caddy server/DNS not ready; this is expected.

---

#### 5. Get Single Workstation (Optional)

**Endpoint**: `GET /api/workstations/:name`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "desk1",
    "name": "desk1",
    "ip_address": "3.3.3.3",
    "domain_name": "desk1.ws.aprender.cloud",
    "status": "online",
    "created_at": "2026-02-08T10:30:00Z",
    "last_check": "2026-02-08T10:35:20Z",
    "dns_error": null,
    "ttyd_url": "https://desk1.ws.aprender.cloud"
  }
}
```

---

### Error Response Standard

All errors follow this format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": "Optional detailed information (dev mode only)"
}
```

**Common Error Codes**:
- `INVALID_INPUT`: Validation failed
- `NOT_FOUND`: Resource not found
- `DUPLICATE`: Already exists
- `DNS_REGISTRATION_FAILED`: Spaceship API error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

### Rate Limiting

- Configured via environment variables
- Applied per-IP address
- Returns 429 Too Many Requests
- Default: 100 requests per 15 minutes per IP

---

## Workstation Service (Bootstrap & Registration)

### Purpose

Auto-register the workstation on boot and handle periodic health checks from Termfleet.

### Implementation Location

Part of the workstation project's `userdata.sh` or a separate systemd service.

### Process Flow

1. **On Boot**:
   - Wait for network connectivity (basic retry loop)
   - Query instance metadata to get local IP (or use configured IP)
   - Parse environment for TERMFLEET_ENDPOINT from userdata
   - POST registration request: `POST <termfleet_endpoint>/api/workstations/register`
   - Log response (success or failure)
   - On DNS registration failure: Log and retry periodically or alert operator

2. **Health Endpoint**:
   - Ensure workstation root path (`https://<domain>/`) responds with 200 OK
   - This is typically handled by Caddy server reverse-proxy
   - No special logic needed; can be a simple OK response

3. **Logging**:
   - Log all registration attempts with timestamps
   - Log success/failure and response details
   - Use consistent format for correlation with Termfleet server logs

### Expected Environment Variables (Workstation)

```bash
TERMFLEET_ENDPOINT=https://termfleet.example.com
WORKSTATION_NAME=desk1  # Or auto-derive from hostname
```

---

## Backend Job - Health Monitoring

### Scheduled Job: Check Online Workstations

**Interval**: Every 20 seconds (configurable via `TERMFLEET_WORKSTATION_CHECK_INTERVAL`)

**Process**:

1. Query SQLite: Get all workstations not yet "removed"
2. For each workstation:
   - Attempt HTTPS GET to `https://<domain_name>/`
   - Timeout: 10 seconds
   - If 200 OK: Process success
   - If timeout or any error: Process failure
3. Apply state transitions based on rules below
4. Update SQLite with new status, timestamps, and last_check

### State Transition Rules

| Current State | Condition | New State | Action |
|---|---|---|---|
| **starting** | 200 OK response | online | Update last_check, state_changed_at |
| **starting** | 10 min timeout (created_at) | unknown | Set unknown_since to now |
| **online** | 200 OK response | online | Update last_check only |
| **online** | No response for 1 min | unknown | Set unknown_since to now |
| **unknown** | 200 OK response | online | Clear unknown_since, update last_check |
| **unknown** | 10 min since unknown_since | terminated | Set terminated_at to now |
| **terminated** | 50 min since terminated_at | removed | Delete from DB (or mark archived) |
| **dns_failed** | (Manual re-register only) | starting | Reset all timestamps |

### Implementation Details

- Job runs asynchronously; should not block request handling
- Use connection pooling for SQLite updates
- Log state changes at DEBUG level with workstation name, old state, new state
- Handle DNS resolution failures gracefully (log, skip that iteration)
- Handle partial failures (one check fails, others continue)

---

## Frontend Specification

### Dashboard Layout

**Route**: `/dashboard`

**Features**:

1. **Workstation Cards Grid**
   - Display workstation as a card with:
     - Workstation name (e.g., "desk1")
     - Status indicator (color-coded: online=green, starting=yellow, unknown=red, dns_failed=orange, terminated=gray)
     - IP address
     - Domain name (clickable, opens ttyd URL in new tab)
     - Last check timestamp (relative: "2 min ago", "just now")
     - TTY access button: Opens `https://<domain>/` in new tab

2. **Filters & Sorting**
   - Filter by status dropdown
   - Sort dropdown: By name, by status, by created date, by last check
   - Order toggle: Ascending / Descending

3. **Auto-Refresh**
   - Real-time preferred: WebSocket connection to `/api/workstations/updates` (if implemented)
   - Fallback polling: Fetch `/api/workstations` every 5 seconds
   - Show "Last updated" timestamp
   - Loading indicator during fetch

4. **Status Color Scheme**
   - **online**: Green (#51cf66)
   - **starting**: Yellow (#ffd43b)
   - **unknown**: Red (#ff6b6b)
   - **dns_failed**: Orange (#ffa94d)
   - **terminated**: Gray (#868e96)
   - **removed**: Not shown unless archived view

5. **Additional Info**
   - Total count of workstations by status (summary bar)
   - Empty state message if no workstations

### Real-Time Updates (Optional Enhancement)

If WebSocket is desired:

**Endpoint**: `WS /api/workstations/updates`

**Message Format**:
```json
{
  "type": "update",
  "data": {
    "workstations": [...]
  }
}
```

**Fallback**: If WebSocket is complex, polling `/api/workstations` every 5 seconds is acceptable.

### Access

- No authentication required
- Credentials: None

---

## Logging Strategy

### Winston Configuration

- **Format**: JSON with timestamp, level, message, metadata
- **Console Output**: INFO level by default
- **File Output**: DEBUG level (all logs), rotated daily or by size
- **Log Directory**: `./logs/` (configurable)
- **Default Level**: DEBUG (configurable via `TERMFLEET_LOG_LEVEL`)

### Log File Structure

```
logs/
  ├─ combined.log        # All logs (DEBUG+)
  ├─ error.log           # Errors only
  └─ termfleet-2026-02-08.log  # Daily rotation
```

### Events to Log

**DEBUG Level**:
- Health check attempts (workstation, URL, result)
- State transitions (with old/new state and timestamps)
- API requests (method, path, response status, duration)
- Database operations (queries, updates)
- Scheduler job execution/completion

**INFO Level**:
- Workstation registration (success/failure with reason)
- DNS registration/update (success/failure)
- Service startup/shutdown
- Configuration loaded

**WARN Level**:
- Health check timeouts
- DNS propagation check failures
- Rate limit hits
- Unexpected workstation state transitions

**ERROR Level**:
- API failures (Spaceship.com, database errors)
- Unhandled exceptions
- Critical configuration missing

### Log Entry Example

```json
{
  "timestamp": "2026-02-08T10:35:20.123Z",
  "level": "INFO",
  "message": "Workstation registered successfully",
  "workstation_name": "desk1",
  "ip": "3.3.3.3",
  "domain": "desk1.ws.aprender.cloud",
  "request_id": "req-uuid-123"
}
```

---

## Deployment & Configuration

### Development

```bash
npm install
npm run dev  # Runs both server and client via concurrently
```

- Server: Localhost:3000
- Client: Vite dev server (HMR enabled)
- Database: `./data/termfleet.db` (local SQLite)

### Production

```bash
npm run build
npm run start
```

- Build React app to static assets
- Run Express server in production mode
- Serve SPA with `/dashboard` route to React app
- API routes `/api/**` handled by Express

### Environment Setup

Create `.env` file in project root with all variables listed above.

### Database Initialization

- Auto-create SQLite schema on first run if tables don't exist
- No migration system needed for MVP

### Systemd Service File (Optional)

For running Termfleet as a service on Linux.

---

## Security Considerations

### Current Implementation (MVP)

- **No authentication** on APIs or dashboard (design choice for training environment)
- **Public endpoint** accessible to trainers/students
- **No sensitive data**: IPs and domains are training infrastructure
- **HTTPS enforcement**: Workstation health checks use HTTPS
- **Rate limiting**: Prevents abuse/DoS

### Future Enhancements (Not MVP)

- API key authentication
- Role-based access control (trainer vs. student)
- Sensitive field encryption in logs
- Audit trail persistence

---

## Scalability & Limits

### Constraints

- **Workstations**: ~20-25 concurrent (tested behavior)
- **Database**: SQLite native; sufficient for this scale
- **Health checks**: 20s interval across ~25 workstations = ~1.25 checks/sec average
- **Concurrent operations**: No locking issues expected

### Potential Bottlenecks (Future)

- SQLite has limited concurrent write capacity; switch to PostgreSQL if >50 workstations
- Health check job can be parallelized with Promise.all() if latency becomes issue

---

## Testing Requirements (Not Implementation)

- Unit tests for state machine transitions
- Integration tests for API endpoints
- Health check job scheduling and execution
- SQLite schema and queries
- Frontend component rendering and interactions
- E2E workflow: Register → Check propagation → Monitor → Auto-recover

---

## Summary of Key Decisions

1. **SQLite** for simplicity and embedded operation
2. **No authentication** for MVP (public endpoint)
3. **Polling-based frontend** with WebSocket as optional future enhancement
4. **Graceful error handling**: DNS failures visible in UI, auto-retries where applicable
5. **Auto-recovery**: Workstations transitioning back to online are treated as live (no manual intervention)
6. **Spaceship.com** for DNS management with API credentials in environment
7. **Winston + file logging** for operational visibility
8. **Scheduled job every 20s** for health monitoring with configurable timeouts/thresholds

---

## Implementation Roadmap (Logical Order)

1. Set up Express server with TypeScript
2. Create SQLite database schema and initialization logic
3. Implement workstation registration API endpoint
4. Implement propagation check endpoint
5. Implement list endpoints with filtering/sorting
6. Build scheduled health check job
7. Create React frontend dashboard with polling
8. Add Winston logging throughout
9. Integrate Spaceship.com API
10. Add rate limiting middleware
11. Environment configuration and .env defaults
12. Testing and documentation

