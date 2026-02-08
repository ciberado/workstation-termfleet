# Implementation Plan - Termfleet & Workstation

## Overview

This document outlines a phased approach to implementing Termfleet and the Workstation registration service. The implementation is split into sequential phases with clear deliverables, dependencies, and acceptance criteria.

**Timeline Estimate**: ~4-6 weeks for full implementation (assumes 1 developer, 40 hrs/week)

---

## Phase 0: Project Infrastructure & Setup (2-3 days)

### Goals
- Set up development environment
- Initialize all repositories with proper tooling
- Configure build and dev scripts
- Establish code quality standards

### Deliverables

#### Termfleet Setup
- [x] Git repository initialized with main branch
- [x] Comprehensive specification document
- [x] Initial CHANGELOG.md
- [x] .env.example with all required variables and defaults
- [x] tsconfig.json, vite.config.ts, package.json all properly configured
- [x] .eslintrc, .prettierrc for code formatting
- [x] .gitignore updated for Node/TypeScript/SQLite/logs
- [x] Directory structure created:
  - `src/server/` - Express backend
  - `src/client/` - React frontend
  - `src/shared/` - Shared types/constants
  - `src/jobs/` - Scheduled jobs
  - `logs/` - Log output (gitignored)
  - `data/` - SQLite database (gitignored)

#### Workstation Setup
- [x] Review existing workstation code structure
- [x] Plan bootstrap service integration point
- [x] Document how userdata.sh will be modified

### Tasks

**Termfleet**:
1. Create `.env.example` from SPEC requirements
2. Update package.json scripts: `dev`, `dev:server`, `dev:client`, `build`, `start`, `test`
3. Create ESLint/Prettier configuration
4. Create directory structure
5. Create `src/shared/types.ts` with base TypeScript interfaces

**Workstation**:
1. Review `src/launch.sh` and `src/userdata.sh`
2. Plan registration service script location
3. Document environment variable passing

### Acceptance Criteria
- [x] `npm install` succeeds
- [x] `npm run dev` starts both client and server
- [x] All directories exist
- [x] ESLint/Prettier configured and working

---

## Phase 1: Backend Foundation (5-7 days)

### Goals
- Set up Express server with middleware
- Create SQLite database layer
- Establish API structure and error handling
- Create base logging system

### Deliverables

#### Database Layer
- [x] SQLite initialization module (`src/server/db/index.ts`)
  - Connect to database
  - Create tables if not exist
  - Migration/schema management
- [x] Database schema file (`src/server/db/schema.sql`)
  - workstations table
  - workstation_events table (optional)
  - Indexes for performance
- [x] Type definitions for database entities (`src/shared/types.ts`)
  - Workstation interface
  - WorkstationStatus enum
  - WorkstationEvent interface

#### Express Server
- [x] Basic Express app setup (`src/server/index.ts`)
  - Port configuration
  - Middleware setup (cors, json, logging)
  - Error handling middleware
  - Request ID tracking
- [x] Environment configuration module (`src/server/config.ts`)
  - Load .env variables
  - Validate required config
  - Provide typed config object
- [x] Request/response utilities (`src/server/utils/`)
  - standardResponse() helper for success responses
  - standardError() helper for error responses
  - AsyncHandler wrapper for route handlers

#### Logging System
- [x] Winston logger configuration (`src/server/logger.ts`)
  - Console transport (INFO level)
  - File transport (DEBUG level) with rotation
  - JSON format with timestamps
  - Request middleware for logging
- [x] Log directory setup with rotation

#### API Structure
- [x] Base Router structure (`src/server/routes/index.ts`)
  - Mount routes at `/api`
- [x] Health check endpoint (`/api/health`) for monitoring
  - Returns 200 OK with service status
- [x] Error handling middleware with standardized responses

### Tasks

1. Create database connection and initialization
2. Write SQLite schema with proper indexes
3. Create TypeScript interfaces/types
4. Set up Express with all middleware
5. Configure Winston logger with file rotation
6. Create utility functions for responses
7. Test database operations with simple queries
8. Verify logging output to console and file

### Acceptance Criteria
- [x] `npm run dev:server` starts on port 3000
- [x] Database file created in `data/termfleet.db`
- [x] Health check endpoint responds with 200
- [x] All logs output to console and `logs/` directory
- [x] TypeScript compiles without errors
- [x] Request IDs tracked in logs

---

## Phase 2: Core API Endpoints (5-7 days)

### Goals
- Implement all 5 API endpoints specified
- Set up request validation
- Handle errors gracefully
- Implement rate limiting middleware

### Deliverables

#### Rate Limiting
- [x] Rate limit middleware (`src/server/middleware/rateLimit.ts`)
  - Per-IP bucket-based limiting
  - Configurable window and max requests
  - Returns 429 on limit exceeded
  - Log rate limit hits

#### Workstation Registration
- [x] POST `/api/workstations/register` endpoint
  - Input validation (name, ip)
  - Check for existing workstation
  - Create or update in database
  - Call Spaceship DNS API
  - Handle DNS failures (set dns_failed status)
  - Return standardized response with domain info
  - Log all registration attempts
- [x] Input validation utilities (`src/server/utils/validation.ts`)
  - Validate workstation name format
  - Validate IPv4 address

#### Domain Propagation Check
- [x] GET `/api/workstations/:name/propagation` endpoint
  - Query Spaceship API or perform DNS check
  - Return boolean propagation status
  - Handle failures gracefully
  - Log check attempts

#### List Workstations
- [x] GET `/api/workstations` endpoint with query params
  - Filter by status (query param)
  - Sort by field (query param)
  - Sort order ascending/descending
  - Include ttyd_url in response
  - Return all workstations with complete info
  - Log list requests

#### Single Workstation
- [x] GET `/api/workstations/:name` endpoint
  - Return single workstation details
  - Handle not found (404)

#### Spaceship.com Integration
- [x] Spaceship service module (`src/server/services/spaceship.ts`)
  - Register/update DNS record
  - Check domain propagation
  - Error handling with descriptive messages
  - Retry logic for propagation checks

### Tasks

1. Create rate limit middleware
2. Create input validation functions
3. Implement registration endpoint with database operations
4. Implement list endpoint with filtering/sorting
5. Implement single workstation endpoint
6. Implement propagation check endpoint
7. Create Spaceship service module
8. Add proper error handling throughout
9. Test all endpoints with Postman/curl

### Acceptance Criteria
- [x] All 5 endpoints implemented and responding
- [x] Rate limiting works (test with rapid requests)
- [x] Validation rejects invalid inputs
- [x] Spaceship integration connects successfully
- [x] Error responses follow standard format
- [x] All operations logged at DEBUG level
- [x] No unhandled promise rejections

---

## Phase 3: Health Check Job (4-5 days)

### Goals
- Implement scheduled health monitoring
- Create state machine logic
- Update workstation statuses dynamically
- Handle edge cases and timeouts

### Deliverables

#### State Machine Implementation
- [x] State machine module (`src/server/services/stateMachine.ts`)
  - Enum for all states
  - Type-safe state transitions
  - Rules engine for transitions based on conditions
  - Timestamp management for timeouts
  - Event emission for state changes

#### Health Check Job
- [x] Scheduler module (`src/server/jobs/scheduler.ts`)
  - Initialize job at server startup
  - Run every 20 seconds (configurable)
  - Error handling prevents job from crashing
- [x] Health check worker (`src/server/jobs/healthCheck.ts`)
  - Fetch all workstations from database
  - For each workstation, attempt HTTPS GET to root
  - 10-second timeout per request
  - Process response/timeout
  - Apply state machine rules
  - Update database with new state + timestamps
  - Log all state transitions with debug info

#### Health Check Logic Details
- [x] Handle starting → online (on 200 OK)
- [x] Handle starting → unknown (on 10 min timeout)
- [x] Handle online → unknown (on 1 min no response)
- [x] Handle unknown → online (on 200 OK response)
- [x] Handle unknown → terminated (on 10 min in unknown)
- [x] Handle terminated → removed (on 50 min in terminated)
- [x] Handle concurrent checks without race conditions

### Tasks

1. Create state machine with all transitions
2. Create health check job scheduler
3. Implement health check worker with HTTP calls
4. Add proper timeout handling
5. Add database update logic with state transitions
6. Add comprehensive logging
7. Test state transitions manually
8. Verify job runs at correct interval

### Acceptance Criteria
- [x] Job starts automatically on server startup
- [x] Job runs every 20 seconds
- [x] Health checks happen in parallel (Promise.all)
- [x] State transitions apply correctly
- [x] Timestamps updated properly for each workstation
- [x] All state changes logged
- [x] Job doesn't crash on network failures
- [x] Starting workstations timeout after 10 minutes

---

## Phase 4: Frontend Dashboard (5-7 days)

### Goals
- Create React SPA for workstation monitoring
- Display real-time workstation status
- Implement filtering and sorting
- Ensure responsive design

### Deliverables

#### React App Structure
- [x] Vite app configured for SPA
- [x] React Router setup (`src/client/main.tsx`)
  - Root route: /dashboard (main dashboard)
  - Other routes as needed
- [x] Mantine theming and setup

#### Dashboard Page
- [x] Dashboard component (`src/client/pages/Dashboard.tsx`)
  - Workstation cards grid layout
  - Status filters dropdown
  - Sort options (name, status, created, last_check)
  - Order toggle (asc/desc)
  - Auto-refresh controls

#### Workstation Card Component
- [x] Card component (`src/client/components/WorkstationCard.tsx`)
  - Display workstation name
  - Status badge (color-coded)
  - IP address
  - Domain name
  - Last check timestamp (relative time: "2 min ago")
  - TTY button (opens domain in new tab)
  - Responsive design

#### API Integration
- [x] Fetch service (`src/client/services/api.ts`)
  - GET `/api/workstations`
  - Handle errors gracefully
- [x] Polling logic
  - Auto-refresh every 5 seconds
  - Show "Last updated" indicator
  - Loading state during fetch

#### Styling & UX
- [x] Mantine components usage
  - Grid for cards
  - Badges for status
  - Buttons for actions
  - Select dropdowns for filters
  - Relative time formatting
- [x] Status color mapping
  - online: green (#51cf66)
  - starting: yellow (#ffd43b)
  - unknown: red (#ff6b6b)
  - dns_failed: orange (#ffa94d)
  - terminated: gray (#868e96)

#### Features
- [x] Summary bar showing count by status
- [x] Empty state message
- [x] Loading indicator
- [x] Error state handling
- [x] Filter by status functionality
- [x] Sort options with persistence (localStorage)

### Tasks

1. Set up Vite React app
2. Configure React Router
3. Create layout components
4. Create workstation card component
5. Create dashboard page with grid layout
6. Implement API fetch service
7. Implement polling logic
8. Add filters and sorting
9. Add status color mapping
10. Test responsive design

### Acceptance Criteria
- [x] Dashboard loads at `/dashboard`
- [x] Workstations display as cards
- [x] Filters work correctly
- [x] Sorting works in both directions
- [x] Auto-refresh works every 5 seconds
- [x] Clicking domain opens new tab
- [x] TTY button works
- [x] Responsive on mobile/tablet
- [x] No TypeScript errors

---

## Phase 5: Build & Serving (2-3 days)

### Goals
- Configure production build
- Set up static file serving
- Ensure SPA routing works
- Optimize for performance

### Deliverables

#### Build Configuration
- [x] Vite build configuration
  - Build React app to `dist/` directory
  - Source maps for debugging
  - Asset optimization
  - Environment-specific builds
- [x] TypeScript build for server

#### Static Serving
- [x] Express middleware to serve static files (`dist/`)
  - Serve `/` → index.html (SPA)
  - Serve `/dashboard` → index.html (React Router)
  - Serve API routes separately
- [x] `src/server/middleware/serveStatic.ts`
  - Proper content-type headers
  - Cache control headers
  - Fallback to index.html for SPA routes

#### Package Scripts
- [x] `npm run build` - Build React + TypeScript
- [x] `npm start` - Start production server
- [x] `npm run dev` - Start dev server (both client/server)

### Tasks

1. Test `npm run build` creates dist/
2. Test `npm start` serves built app
3. Verify `/dashboard` route works
4. Verify API routes still work
5. Test in production mode locally
6. Add proper cache headers

### Acceptance Criteria
- [x] `npm run build` succeeds
- [x] `dist/` directory created with compiled React app
- [x] `npm start` serves app on port 3000
- [x] Dashboard loads at `/dashboard`
- [x] API routes functional
- [x] Static files cached (no re-download)

---

## Phase 6: Workstation Bootstrap Service (4-5 days)

### Goals
- Create registration service for workstation
- Handle auto-registration on boot
- Implement retry logic
- Set up logging

### Deliverables

#### Bootstrap Script
- [x] Workstation registration service script (`src/register-workstation.sh`)
  - Runs as systemd service or via userdata.sh
  - Source environment variables:
    - TERMFLEET_ENDPOINT
    - WORKSTATION_NAME (or derive from hostname)
    - Instance IP address (from metadata service or parameter)
  - Retry loop for network availability (wait for internet)
  - POST registration request to Termfleet
  - Log results with timestamps
  - Retry on failure (exponential backoff)
  - Handle DNS registration failure cases

#### Systemd Service (Optional)
- [x] Systemd service file for auto-start
  - Set dependencies (After=network-online.target)
  - Restart policy
  - Working directory
  - User/group

#### Integration with Userdata
- [x] Modify `src/userdata.sh` to:
  - Accept TERMFLEET_ENDPOINT as parameter
  - Accept WORKSTATION_NAME as parameter
  - Call registration service at startup
  - Wait for Caddy/ttyd to be running before registration
  - Handle registration failures gracefully

#### Logging
- [x] Log file output from registration service
  - `var/log/workstation-registration.log`
  - Timestamps for each attempt
  - Success/failure messages
  - Response details

### Tasks

1. Create registration service script
2. Implement retry logic with exponential backoff
3. Create systemd service file
4. Integrate with userdata.sh
5. Test registration on instance boot
6. Test retry on DNS failure
7. Verify logs output properly
8. Test re-registration with different IP

### Acceptance Criteria
- [x] Script runs on boot
- [x] Successfully registers with Termfleet
- [x] Retries on network failure
- [x] Logs to file with timestamps
- [x] Handles DNS registration failure
- [x] Can be run manually for testing
- [x] Works with environment variables

---

## Phase 7: Logging & Monitoring (2-3 days)

### Goals
- Ensure comprehensive logging throughout system
- Verify log levels appropriate
- Test log rotation
- Ensure logs are useful for debugging

### Deliverables

#### Termfleet Logging Review
- [x] Verify all API endpoints log requests
- [x] Verify all state transitions logged
- [x] Verify health check attempts logged
- [x] Verify database operations logged
- [x] Verify error cases logged with context
- [x] Test log rotation works
- [x] Verify different log levels used appropriately

#### Workstation Logging Review
- [x] Verify registration attempts logged
- [x] Verify success/failure logged
- [x] Verify retries logged
- [x] Verify response details logged
- [x] Test log file rotation

### Tasks

1. Review all logger calls in termfleet
2. Add logging to any missing areas
3. Test log output at different levels
4. Verify log format is consistent
5. Test log rotation
6. Review for sensitive data in logs

### Acceptance Criteria
- [x] All important operations logged
- [x] Logs useful for troubleshooting
- [x] No sensitive data in logs
- [x] Log rotation working
- [x] Appropriate log levels used

---

## Phase 8: Testing (5-7 days)

### Goals
- Comprehensive test coverage
- Manual integration testing
- Load testing for ~20 workstations
- Edge case testing

### Deliverables

#### Unit Tests
- [ ] Database layer tests
  - Create/read/update operations
  - State transitions
- [ ] State machine tests
  - All transitions work
  - Invalid transitions rejected
- [ ] Validation tests
  - Input validation works
  - Edge cases handled
- [ ] API utility tests
  - Response formatting
  - Error handling

#### Integration Tests
- [ ] API endpoint tests
  - Registration flow
  - List/filter/sort
  - Propagation check
- [ ] Health check job tests
  - State transitions apply
  - Database updates
  - Timeout handling
- [ ] Spaceship integration tests
  - DNS registration
  - Propagation check
  - Error handling

#### Frontend Tests
- [ ] Component tests (React Testing Library)
  - Card rendering
  - Filter functionality
  - Sorting functionality
- [ ] API integration tests
  - Fetch data correctly
  - Handle errors
  - Update on refresh

#### Manual Testing Checklist
- [ ] Complete workflow:
  1. Boot workstation with registration service
  2. Verify registration in Termfleet
  3. Verify DNS propagation
  4. Verify shows in dashboard as "starting"
  5. Verify status changes to "online" after health check
  6. Stop workstation
  7. Verify status changes to "unknown" after 1 min
  8. Verify status changes to "terminated" after 10 min in unknown
  9. Restart workstation
  10. Verify status returns to "online"
- [ ] Filter and sort dashboard
- [ ] Click domain link (opens ttyd)
- [ ] Rate limiting works
- [ ] Error cases handled gracefully

### Tasks

1. Set up Jest for unit testing
2. Write database layer tests
3. Write state machine tests
4. Write API endpoint tests
5. Write health check job tests
6. Set up React Testing Library
7. Write component tests
8. Manual testing with real instances
9. Test with ~20 concurrent workstations
10. Stress test health check job

### Acceptance Criteria
- [ ] 80%+ code coverage (excluding main.tsx, config)
- [ ] All tests passing
- [ ] Manual workflow tested
- [ ] Edge cases handled
- [ ] Performance acceptable with 20 workstations

---

## Phase 9: Documentation & Polish (2-3 days)

### Goals
- Complete developer documentation
- Create deployment guide
- Create operational guide
- Ensure code is well-commented

### Deliverables

#### Code Documentation
- [ ] README.md with:
  - Project overview
  - Technology stack
  - Getting started guide
  - Project structure explanation
  - Development commands
  - Environment setup
- [ ] API documentation (OpenAPI/Swagger optional)
  - Request/response examples
  - Error codes
  - Rate limits
- [ ] Architecture diagram
- [ ] Code comments for complex logic

#### Deployment Guide
- [ ] Production deployment steps
  - Environment variables
  - Database setup
  - Build process
  - Service startup
- [ ] Systemd service files
  - Termfleet service
  - Workstation registration service
- [ ] Reverse proxy configuration (nginx)
  - HTTPS setup
  - URL routing
  - Port configuration

#### Operational Guide
- [ ] Monitoring workstations
  - Log locations
  - Common issues and solutions
  - Performance tuning
- [ ] Troubleshooting guide
  - Health check failures
  - DNS registration failures
  - Database issues
- [ ] Maintenance tasks
  - Database backups
  - Log cleanup
  - Updates

### Tasks

1. Write comprehensive README.md
2. Document API endpoints (copy from SPEC.md)
3. Create deployment guide
4. Create operational guide
5. Add comments to complex code sections
6. Create architecture diagram (ASCII or image)
7. Review all documentation

### Acceptance Criteria
- [ ] New developer can follow README to get running
- [ ] Deployment instructions clear
- [ ] Common issues documented
- [ ] All config options documented

---

## Phase 10: Production Deployment (2-3 days)

### Goals
- Deploy to production environment
- Configure monitoring
- Perform final integration testing
- Handoff to operations team

### Deliverables

#### Deployment
- [ ] Deploy Termfleet to production server
  - Set environment variables
  - Create SQLite database
  - Build application
  - Start service
  - Verify health check endpoint
- [ ] Deploy workstation images with registration service
  - Test registration from deployed instance
  - Verify dashboard shows workstation
  - Verify DNS resolves
- [ ] Configure monitoring/alerting (optional)
  - Health check endpoint
  - Error rate
  - Database size

#### Final Testing
- [ ] End-to-end testing in production
  - Boot new workstation
  - Verify appears in dashboard
  - Verify status transitions
  - Verify TTY access works
- [ ] Load testing with target workstations (20-25)
- [ ] 24-hour soak test

### Tasks

1. Prepare production environment
2. Deploy Termfleet
3. Deploy updated workstation image
4. Run end-to-end tests
5. Run load tests
6. Monitor for 24 hours
7. Handoff documentation

### Acceptance Criteria
- [ ] Termfleet running stable in production
- [ ] 10+ workstations successfully tracked
- [ ] Dashboard responsive
- [ ] No critical errors in logs
- [ ] Ready for trainer use

---

## Cross-Phase Considerations

### Code Quality
- TypeScript strict mode enabled
- ESLint/Prettier enforced on commit (pre-commit hooks)
- No console.log (use logger instead)
- No any types without justification
- Consistent error handling patterns

### Testing Strategy
- TDD approach where complex logic exists
- Test database operations thoroughly
- Test state machine exhaustively
- Manual integration testing between phases

### Git Workflow
- Feature branches for major features
- PR reviews before merge
- Commit messages follow Conventional Commits
- Tag releases with version numbers

### Environment Management
- .env.example keeps documentation
- .env in .gitignore (never committed)
- Different configs for dev/prod
- Validate config on startup

### Performance
- Database queries indexed appropriately
- Health check job parallelized
- API responses cached where appropriate
- Static assets minified/gzipped

---

## Risk Mitigation

### High-Risk Items
1. **Spaceship.com API Integration**
   - Risk: API changes, rate limits, authentication issues
   - Mitigation: Comprehensive error handling, test account setup early, monitor API status
   
2. **HTTPS Health Checks**
   - Risk: Certificate validation issues, network timeouts
   - Mitigation: Proper certificate setup, generous timeouts, graceful degradation
   
3. **State Machine Complexity**
   - Risk: Incorrect state transitions, race conditions
   - Mitigation: Exhaustive testing, clear documentation, state transition diagram
   
4. **Scalability (20+ workstations)**
   - Risk: SQLite bottleneck, slow dashboard
   - Mitigation: Proper indexing, query optimization, future migration plan to PostgreSQL

5. **Workstation Bootstrap Service**
   - Risk: Integration issues with existing infrastructure
   - Mitigation: Careful integration planning, test with real instances, logging

### Mitigation Strategies
- Comprehensive logging throughout
- Early integration testing
- Regular code reviews
- Clear error messages for troubleshooting

---

## Success Criteria (Project Complete)

1. ✅ All API endpoints implemented and tested
2. ✅ Dashboard functional with filtering/sorting
3. ✅ Health check job running every 20 seconds
4. ✅ State machine correctly transitions workstations
5. ✅ Workstations auto-register on boot
6. ✅ 80%+ test coverage
7. ✅ Complete documentation
8. ✅ Runs stably with 20-25 concurrent workstations
9. ✅ All logs output to files with rotation
10. ✅ Production deployment tested

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| 0: Infrastructure | 2-3 days | 2-3 days |
| 1: Backend Foundation | 5-7 days | 7-10 days |
| 2: Core APIs | 5-7 days | 12-17 days |
| 3: Health Check Job | 4-5 days | 16-22 days |
| 4: Frontend Dashboard | 5-7 days | 21-29 days |
| 5: Build & Serving | 2-3 days | 23-32 days |
| 6: Workstation Service | 4-5 days | 27-37 days |
| 7: Logging & Monitoring | 2-3 days | 29-40 days |
| 8: Testing | 5-7 days | 34-47 days |
| 9: Documentation & Polish | 2-3 days | 36-50 days |
| 10: Production Deployment | 2-3 days | 38-53 days |

**Total: 4-6 weeks** (assuming full-time development)

---

## Notes

- Each phase builds upon previous ones
- Phases 1-5 focus on Termfleet backend/frontend
- Phase 6 bridges to Workstation project
- Testing (phase 8) should include both projects
- Significant overlap possible if developer works on multiple phases
- Adjustments may be needed based on actual complexity discoveries
