-- Termfleet Database Schema
-- SQLite3

-- Workstations table
CREATE TABLE IF NOT EXISTS workstations (
  id              TEXT PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  ip_address      TEXT NOT NULL,
  domain_name     TEXT,
  status          TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  last_check      TEXT,
  state_changed_at TEXT NOT NULL,
  dns_error       TEXT,
  started_at      TEXT,
  unknown_since   TEXT,
  terminated_at   TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workstations_status ON workstations(status);
CREATE INDEX IF NOT EXISTS idx_workstations_last_check ON workstations(last_check);
CREATE INDEX IF NOT EXISTS idx_workstations_name ON workstations(name);

-- Workstation events table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS workstation_events (
  id              TEXT PRIMARY KEY,
  workstation_id  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  old_status      TEXT,
  new_status      TEXT,
  details         TEXT,
  timestamp       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id)
);

-- Index for events
CREATE INDEX IF NOT EXISTS idx_events_workstation ON workstation_events(workstation_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON workstation_events(timestamp);
