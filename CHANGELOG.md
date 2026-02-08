# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] - 2026-02-08

### Added

#### Phase 0: Project Infrastructure & Setup
- Git repository initialized with main branch (Javi Moreno)
- Comprehensive 800+ line specification document (SPEC.md)
- 10-phase implementation plan (PLAN.md)
- Complete TypeScript configuration (tsconfig.json, tsconfig.node.json, tsconfig.server.json)
- Vite configuration for React frontend
- ESLint and Prettier for code quality
- Environment template (.env.example) with 13 configuration variables
- Directory structure: src/server/, src/client/, src/shared/, docs/
- Package.json with all dependencies and NPM scripts

#### Phase 1: Backend Foundation
- Express 4.18.2 server with TypeScript ES modules
- SQLite database with better-sqlite3 ORM
- Database schema (schema.sql) with workstations and events tables
- Indexed queries for performance (status, created_at)
- Winston logging with JSON format and file rotation (10MB, 5 files)
- Configuration module loading 13 environment variables
- Request ID tracking (UUID) for request correlation
- Middleware pipeline: CORS, JSON parsing, rate limiting, error handling
- Health check endpoint (/health) for monitoring
- Shared TypeScript types (WorkstationStatus enum, interfaces)

#### Phase 2: Core API Endpoints
- POST /api/workstations/register - Register workstation with DNS
  - Input validation (name: alphanumeric+hyphen, IP: IPv4 format)
  - Spaceship.com DNS A record creation
  - Database persistence with starting status
  - Handles DNS failures gracefully (dns_failed status)
- GET /api/workstations/:name/propagation - Check DNS propagation
  - DNS lookup verification
  - Returns expected vs resolved IP comparison
- GET /api/workstations - List all workstations
  - Filter by status query parameter
  - Sort by field (name, created_at, last_check, status)
  - Sort order (asc/desc)
- GET /api/workstations/:name - Get single workstation
  - Returns 404 for non-existent workstations
- Rate limiting: 100 requests/minute per IP (configurable)
- Spaceship.com DNS integration service (spaceship.ts)
  - X-API-Key and X-API-Secret authentication
  - A record registration with configurable TTL (600s default)
  - Error handling for API failures

#### Phase 3: Health Check Job
- State machine service (stateMachine.ts) with 6 states:
  - starting → online (on successful health check)
  - starting → unknown (10 min timeout)
  - online → unknown (1 min no response)
  - unknown → online (recovery on successful check)
  - unknown → terminated (10 min in unknown state)
  - terminated → removed (50 min cleanup)
- Health check job (healthCheck.ts):
  - Runs every 20 seconds (configurable)
  - Parallel checks using Promise.all
  - 10-second timeout per workstation
  - HTTP GET to terminal root endpoint
  - State machine rule application
  - Database updates with timestamps
  - Event logging for state transitions
- Scheduler (scheduler.ts):
  - Automatic startup with server
  - setInterval-based execution
  - Error handling prevents job crashes

#### Phase 4: Frontend Dashboard
- React 18.2.0 SPA with Vite 7.3.1
- Mantine 7.5.0 UI component library
- React Router DOM for routing
- Dashboard page (Dashboard.tsx):
  - Grid layout with responsive breakpoints
  - Status filter dropdown (all, online, starting, unknown, etc.)
  - Sort controls (name, status, created_at, last_check)
  - Sort direction toggle (ascending/descending)
  - Summary badges showing count by status
  - Auto-refresh every 5 seconds with useEffect polling
  - Loading and error states
  - Empty state handling
- Workstation Card component (WorkstationCard.tsx):
  - Color-coded status badges (green=online, yellow=starting, red=unknown, etc.)
  - Workstation name and IP display
  - Domain name with copy capability
  - Relative timestamps using dayjs ("2 minutes ago")
  - "Open Terminal" button with external link
  - Responsive card design
- API service (api.ts):
  - Fetch workstations with filtering/sorting
  - Error handling and logging
  - TypeScript integration with shared types
- Path aliases (@/shared, @/client) for clean imports

#### Phase 5: Build & Serving
- Vite production build:
  - Optimized bundle: 345KB JS (111KB gzipped)
  - CSS bundle: 200KB (29KB gzipped)
  - Output to dist/client/
- TypeScript compilation for server to dist/server/
- Static file serving middleware (serveStatic.ts):
  - Serves built React app from dist/client/
  - SPA routing fallback (all routes → index.html)
  - Development mode detection
- NPM scripts:
  - `npm run dev` - Concurrent client + server development
  - `npm run dev:server` - Server only with tsx watch
  - `npm run dev:client` - Vite dev server only
  - `npm run build` - Production build (client + server)
  - `npm start` - Start production server

#### Phase 6: Workstation Bootstrap Service
- Registration script (register-termfleet.sh):
  - Network connectivity waiting with timeout
  - IP detection from network interfaces or AWS metadata
  - Registration POST to Termfleet endpoint
  - Exponential backoff retry logic (5 attempts)
  - Comprehensive logging to /var/log/termfleet-registration.log
  - Environment variable configuration
- Systemd service (termfleet-registration.service):
  - Auto-start on boot (After=network-online.target)
  - Restart policy (on-failure with 30s delay)
  - Rate limiting (5 attempts max)
  - EnvironmentFile support
- Configuration template (termfleet.conf.example):
  - TERMFLEET_ENDPOINT variable
  - Optional WORKSTATION_NAME override
- Integration documentation (TERMFLEET_INTEGRATION.md):
  - Installation steps
  - Systemd service setup
  - Userdata.sh integration examples
  - Troubleshooting guide
  - Security considerations

#### Documentation
- Comprehensive README.md (510 lines):
  - Feature overview with emoji indicators
  - Architecture diagrams and state machine explanation
  - API endpoint reference table
  - Quick start and installation guide
  - Development workflow and project structure
  - Configuration reference (13 environment variables)
  - Database schema documentation
  - API examples with curl
  - Health check explanation
  - DNS integration details
  - Monitoring and logging guide
  - Security features (rate limiting, CORS, validation)
  - Production deployment checklist
  - Troubleshooting section
  - Contributing guidelines
- Updated PLAN.md with 91 completed checkboxes across phases 0-6
- All phases marked complete with acceptance criteria met

### Fixed
- TypeScript linter errors with unused imports/variables
- Vite path resolution using @/ aliases instead of relative paths
- Multiple typos in variable names and function names
- Import consistency across client components
- Build errors preventing production compilation

### Changed
- State machine uses underscore-prefixed parameters for unused variables
- Middleware functions follow ESLint no-unused-vars rules
- All imports normalized to use path aliases
- CHANGELOG updated to reflect actual implementation

### Technical Details
- Node.js ES modules throughout
- TypeScript 5.3.3 with strict mode
- SQLite with WAL mode support
- Winston with daily rotation transport
- Express middleware pipeline order optimized
- React hooks for state management
- Mantine v7 UI components
- Better-sqlite3 synchronous API (no async/await needed)
- 20-second health check interval
- 10-second health check timeout per workstation
- 600-second DNS TTL
- Base domain: ws.aprender.cloud

### Repository Statistics
- Total commits: 7
- Lines of code: ~2,000 (TypeScript/TSX)
- Files created: 35+
- Git history:
  1. Initial project setup with comprehensive specification
  2. Add comprehensive implementation plan with 10 phases
  3. Implement backend: API endpoints, health check job, state machine
  4. Implement React frontend with dashboard and workstation cards
  5. Fix build errors and complete implementation
  6. Add comprehensive README documentation
  7. Fix TypeScript linter errors - use consistent path aliases
  8. Update PLAN.md to reflect completed phases 0-6

### Project Status
- ✅ Phases 0-6 complete and production-ready
- ✅ Successfully builds without errors
- ✅ All TypeScript/ESLint checks passing
- ⏳ Phases 7-10 pending (Testing, Logging review, Documentation polish, Deployment)

### Next Steps
- Phase 7: Review logging implementation
- Phase 8: Add comprehensive test suite (Jest + React Testing Library)
- Phase 9: Polish documentation and add deployment guides
- Phase 10: Production deployment with Docker/systemd
