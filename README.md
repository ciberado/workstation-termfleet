# Termfleet

Centralized management and access to ttyd-based web terminals across multiple workstations.

## Features

- 🖥️ **Automatic Workstation Registration** - Workstations self-register on boot
- 🌍 **DNS Management** - Automatic subdomain creation via Spaceship.com API
- 🔄 **State Machine** - Intelligent lifecycle management (starting → online → unknown → terminated → removed)
- ❤️ **Health Monitoring** - Continuous health checks with configurable intervals
- 📊 **Dashboard** - Real-time React dashboard with status cards
- 🔍 **Filtering & Sorting** - Filter by status, sort by multiple fields
- 🚀 **Auto-refresh** - Live updates every 5 seconds
- 📝 **Event Logging** - Full audit trail of workstation events
- 🔒 **Rate Limiting** - Built-in API protection
- 🎯 **Direct Terminal Access** - One-click links to web terminals

## Architecture

### Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite with better-sqlite3
- **Frontend**: React 18 + Vite + Mantine UI
- **Logging**: Winston with file rotation
- **DNS**: Spaceship.com API integration
- **Scheduling**: Node.js intervals for health checks

### State Machine

Workstations transition through the following states:

```
STARTING → ONLINE ─────────┐
    │         │             │
    │         ↓             │
    │    UNKNOWN ←──────────┘
    │         │
    │         ↓
    └───→ TERMINATED → REMOVED
          (cleanup)
```

**State Transitions:**
- `starting` → `online`: Successful health check
- `starting` → `unknown`: No response after 10 minutes
- `online` → `unknown`: No response after 1 minute
- `unknown` → `online`: Health check succeeds (recovery)
- `unknown` → `terminated`: No response after 10 minutes
- `terminated` → `removed`: Cleanup after 50 minutes

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `POST` | `/api/workstations/register` | Register new workstation |
| `GET` | `/api/workstations/:name/propagation` | Check DNS propagation |
| `GET` | `/api/workstations` | List all workstations |
| `GET` | `/api/workstations/:name` | Get single workstation |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Spaceship.com account with API credentials

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd termfleet
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update required variables:
   ```env
   # Required
   SPACESHIP_API_KEY=your_api_key_here
   SPACESHIP_API_SECRET=your_api_secret_here
   BASE_DOMAIN=ws.aprender.cloud
   
   # Optional - defaults provided
   PORT=3000
   NODE_ENV=development
   DATABASE_PATH=./termfleet.db
   ```

3. **Build Frontend**
   ```bash
   npm run build
   ```

4. **Start Server**
   ```bash
   # Development mode (with hot reload)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access Dashboard**
   
   Open http://localhost:3000 in your browser

## Development

### Project Structure

```
termfleet/
├── src/
│   ├── server/          # Backend Express server
│   │   ├── db/          # SQLite database layer
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic (DNS, state machine)
│   │   ├── jobs/        # Scheduled tasks (health checks)
│   │   ├── middleware/  # Express middleware
│   │   ├── utils/       # Utility functions
│   │   ├── config.ts    # Configuration loader
│   │   ├── logger.ts    # Winston logger setup
│   │   └── index.ts     # Server entry point
│   ├── client/          # Frontend React app
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable components
│   │   ├── services/    # API client
│   │   ├── App.tsx      # Root component
│   │   └── main.tsx     # Entry point
│   └── shared/          # Shared TypeScript types
│       └── types.ts     # Common interfaces
├── dist/                # Build output (generated)
│   ├── client/          # Frontend bundle
│   └── server/          # Compiled server
├── docs/                # Documentation
│   ├── SPEC.md          # Comprehensive specification
│   └── PLAN.md          # Implementation phases
├── schema.sql           # Database schema
├── .env.example         # Environment template
└── package.json         # Dependencies
```

### Available Scripts

```bash
# Development
npm run dev              # Start both server and client (concurrent)
npm run dev:server       # Start server only (tsx watch)
npm run dev:client       # Start Vite dev server only

# Building
npm run build            # Build both client and server
npm run build:client     # Build React frontend (Vite)
npm run build:server     # Compile TypeScript server

# Production
npm start                # Start production server

# Preview
npm run preview          # Preview production build locally
```

## Workstation Integration

To enable automatic registration of workstations with Termfleet, see the [Workstation Integration Guide](../workstation/docs/TERMFLEET_INTEGRATION.md).

### Quick Integration

On each workstation, install the registration service:

```bash
# Set Termfleet endpoint
TERMFLEET_ENDPOINT="https://your-termfleet-server.com"

# Download and install registration script
wget -O /usr/local/bin/register-termfleet.sh \
  https://raw.githubusercontent.com/your-repo/workstation/main/src/register-termfleet.sh
chmod +x /usr/local/bin/register-termfleet.sh

# Download systemd service
wget -O /etc/systemd/system/termfleet-registration.service \
  https://raw.githubusercontent.com/your-repo/workstation/main/src/termfleet-registration.service

# Create config
cat << EOF > /etc/termfleet.conf
TERMFLEET_ENDPOINT=${TERMFLEET_ENDPOINT}
WORKSTATION_NAME=$(hostname)
EOF

# Enable and start
systemctl daemon-reload
systemctl enable --now termfleet-registration.service
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `./termfleet.db` | SQLite database file |
| `LOG_LEVEL` | `debug` | Winston log level |
| `LOG_FILE` | `./logs/termfleet.log` | Log file path |
| `BASE_DOMAIN` | `ws.aprender.cloud` | Base domain for workstations |
| `DNS_TTL` | `600` | DNS record TTL (seconds) |
| `SPACESHIP_API_KEY` | *(required)* | Spaceship.com API key |
| `SPACESHIP_API_SECRET` | *(required)* | Spaceship.com API secret |
| `WORKSTATION_CHECK_INTERVAL` | `20000` | Health check interval (ms) |
| `WORKSTATION_CHECK_TIMEOUT` | `10000` | Health check timeout (ms) |
| `MAX_REQUESTS_PER_MINUTE` | `100` | Rate limit per IP |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

### Database Schema

The SQLite database includes two main tables:

**workstations** - Stores workstation information
- Primary key: `name`
- Tracks status, IP, domain, timestamps
- Indexed on `status` and `created_at`

**workstation_events** - Audit trail
- Records all state changes
- References workstation by name
- Timestamped event log

See [schema.sql](schema.sql) for full schema.

## API Documentation

### Register Workstation

```bash
POST /api/workstations/register
Content-Type: application/json

{
  "name": "desk1",
  "ip": "192.168.1.100"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "name": "desk1",
    "ip_address": "192.168.1.100",
    "domain_name": "desk1.ws.aprender.cloud",
    "status": "starting",
    "terminal_url": "http://desk1.ws.aprender.cloud:7681"
  }
}
```

### Check DNS Propagation

```bash
GET /api/workstations/:name/propagation
```

**Response**:
```json
{
  "success": true,
  "data": {
    "propagated": true,
    "expected_ip": "192.168.1.100",
    "resolved_ip": "192.168.1.100"
  }
}
```

### List Workstations

```bash
GET /api/workstations?status=online&sort=name
```

**Query Parameters:**
- `status`: Filter by status (e.g., `online`, `starting`)
- `sort`: Sort field (e.g., `name`, `created_at`, `last_check`)
- `order`: Sort order (`asc` or `desc`)

### Get Single Workstation

```bash
GET /api/workstations/:name
```

## Health Checks

The health check job runs every 20 seconds (configurable) and:

1. Fetches all workstations from database
2. Checks each workstation's terminal endpoint (port 7681)
3. Applies state machine rules based on response
4. Updates workstation status and timestamps
5. Logs events for state transitions

Health checks respect the 10-second timeout and run in parallel for all workstations.

## DNS Integration

Termfleet integrates with [Spaceship.com](https://www.spaceship.com/) for DNS management:

- **Automatic A records**: Creates subdomain for each workstation
- **API Authentication**: Uses X-API-Key and X-API-Secret headers
- **TTL Management**: Configurable DNS TTL (default: 10 minutes)
- **Propagation Checks**: Verifies DNS updates via lookup

### Spaceship API Requirements

1. Create API credentials in Spaceship dashboard
2. Add `SPACESHIP_API_KEY` and `SPACESHIP_API_SECRET` to `.env`
3. Ensure API has permissions for DNS zone management

## Monitoring & Logging

### Logs

Logs are written to:
- Console (stdout) - formatted for development
- File (`./logs/termfleet.log`) - JSON format with rotation

**Log Levels**: `error`, `warn`, `info`, `debug`

### Log Rotation

Winston automatically rotates logs:
- Max size: 10MB per file
- Max files: 5
- Compression: gzipped old logs

### Request Logging

All HTTP requests are logged with:
- Request ID (UUID)
- Method, URL, status code
- Response time
- IP address

## Security

### Rate Limiting

API endpoints are protected with rate limiting:
- 100 requests per minute per IP (configurable)
- Returns 429 Too Many Requests when exceeded

### CORS

CORS is enabled with configurable origins:
- Default: Allow all (`*`)
- Production: Set `CORS_ORIGIN` to specific domain

### Input Validation

All API inputs are validated:
- Workstation names: alphanumeric + hyphens only
- IP addresses: IPv4 format validation
- Required field checks

## Deployment

### Production Checklist

1. **Environment Setup**
   - [ ] Set `NODE_ENV=production`
   - [ ] Configure proper `CORS_ORIGIN`
   - [ ] Set strong `SPACESHIP_API_KEY`/`SECRET`
   - [ ] Configure `LOG_LEVEL=info` or `warn`

2. **Build**
   ```bash
   npm run build
   ```

3. **Database**
   - Ensure `DATABASE_PATH` is writable
   - Consider backup strategy
   - Enable SQLite WAL mode for better concurrency

4. **Reverse Proxy**
   - Use Nginx or Caddy in front of Node.js
   - Enable HTTPS with Let's Encrypt
   - Set proper headers (HSTS, CSP, etc.)

5. **Process Manager**
   - Use PM2 or systemd service
   - Enable auto-restart on failure
   - Configure log rotation

### Example systemd Service

```ini
[Unit]
Description=Termfleet Server
After=network-online.target

[Service]
Type=simple
User=termfleet
WorkingDirectory=/opt/termfleet
EnvironmentFile=/opt/termfleet/.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker (Future)

Docker support is planned for easier deployment.

## Troubleshooting

### Server won't start

**Issue**: Database locked or port in use

**Solution**:
```bash
# Check port availability
lsof -i :3000

# Check database file permissions
ls -la termfleet.db

# Enable SQLite WAL mode
sqlite3 termfleet.db "PRAGMA journal_mode=WAL;"
```

### DNS registration fails

**Issue**: Spaceship API returns error

**Solution**:
1. Verify API credentials are correct
2. Check API key has DNS zone permissions
3. Ensure base domain exists in Spaceship
4. Check Spaceship API status

### Workstations stuck in "starting"

**Issue**: Health checks timing out

**Solution**:
1. Verify workstation is reachable from server
2. Check firewall allows port 7681
3. Ensure ttyd is running on workstation
4. Increase `WORKSTATION_CHECK_TIMEOUT`

### Frontend shows 404

**Issue**: Static files not served

**Solution**:
```bash
# Build frontend
npm run build

# Verify dist/client exists
ls -la dist/client/

# Check server logs for serving errors
tail -f logs/termfleet.log
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - See LICENSE file for details

## Documentation

- [Complete Specification](docs/SPEC.md) - Comprehensive technical spec
- [Implementation Plan](docs/PLAN.md) - 10-phase development roadmap
- [Workstation Integration](../workstation/docs/TERMFLEET_INTEGRATION.md) - Integration guide

## Support

For issues, questions, or suggestions:
- Open a GitHub issue
- Check existing documentation
- Review logs for error details

---

Built with ❤️ for centralized terminal management
