# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] - 2026-02-08

### Added

- Complete backend implementation
  - Express server with TypeScript
  - SQLite database with better-sqlite3
  - Winston logging with file rotation
  - Rate limiting middleware
  - REST API with 5 endpoints (register, propagation, list, single, health)
  - Spaceship.com DNS integration for automatic subdomain management
  - State machine for workstation lifecycle management
  - Health check job running every 20 seconds
  - Comprehensive error handling and logging

- Frontend React dashboard
  - Mantine UI component library
  - Real-time auto-refresh (5-second polling)
  - Workstation cards with status indicators
  - Filtering by status
  - Sorting by multiple fields
  - Direct links to workstation TTY terminals
  - Responsive design for mobile/tablet

- Workstation bootstrap service
  - Automatic registration script
  - Systemd service for reliability
  - Retry logic with exponential backoff
  - Comprehensive logging
  - Integration documentation

- Complete specification and implementation plan
  - 10-phase implementation roadmap
  - Detailed API documentation
  - State machine diagrams
  - Architecture documentation
  - Database schema with indexes

### Project Structure

- Initialized git repository with main branch
- Project setup with TypeScript, Express, React, and Vite
- Environment configuration template
- ESLint and Prettier configuration
- Organized directory structure for scalability
