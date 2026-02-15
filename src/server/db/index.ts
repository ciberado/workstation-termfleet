import Database from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  Workstation,
  WorkstationStatus,
  WorkstationEvent,
} from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
export const db = new Database(config.dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema
 */
export function initializeDatabase(): void {
  logger.info('Initializing database schema');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema (split by semicolon and execute each statement)
    const statements = schema.split(';').filter((stmt) => stmt.trim().length > 0);

    statements.forEach((statement) => {
      db.exec(statement);
    });

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database schema', { error });
    throw error;
  }
}

// ============================================================
// Workstation Operations
// ============================================================

/**
 * Create a new workstation
 */
export function createWorkstation(workstation: Omit<Workstation, 'id'>): Workstation {
  const id = workstation.name; // Use name as ID for simplicity
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO workstations (
      id, name, ip_address, domain_name, status, created_at,
      last_check, state_changed_at, dns_error, started_at,
      unknown_since, terminated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    workstation.name,
    workstation.ip_address,
    workstation.domain_name,
    workstation.status,
    workstation.created_at || now,
    workstation.last_check,
    workstation.state_changed_at || now,
    workstation.dns_error,
    workstation.started_at || now,
    workstation.unknown_since,
    workstation.terminated_at
  );

  logger.debug('Workstation created', { name: workstation.name, id });

  return { id, ...workstation };
}

/**
 * Get workstation by name
 */
export function getWorkstationByName(name: string): Workstation | null {
  const stmt = db.prepare('SELECT * FROM workstations WHERE name = ?');
  const row = stmt.get(name) as Workstation | undefined;
  return row || null;
}

/**
 * Get all workstations with optional filtering and sorting
 */
export function getAllWorkstations(options?: {
  status?: WorkstationStatus;
  sort?: 'name' | 'status' | 'created_at' | 'last_check';
  order?: 'asc' | 'desc';
}): Workstation[] {
  let query = 'SELECT * FROM workstations';
  const params: string[] = [];

  if (options?.status) {
    query += ' WHERE status = ?';
    params.push(options.status);
  }

  if (options?.sort) {
    const sortField = options.sort;
    const sortOrder = options.order || 'asc';
    query += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Workstation[];

  return rows;
}

/**
 * Update workstation
 */
export function updateWorkstation(name: string, updates: Partial<Workstation>): boolean {
  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'name') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    return false;
  }

  values.push(name);

  const query = `UPDATE workstations SET ${fields.join(', ')} WHERE name = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);

  logger.debug('Workstation updated', { name, changes: result.changes });

  return result.changes > 0;
}

/**
 * Delete workstation
 */
export function deleteWorkstation(name: string): boolean {
  // First, get the workstation ID
  const ws = db.prepare('SELECT id FROM workstations WHERE name = ?').get(name) as { id: string } | undefined;
  
  if (!ws) {
    logger.debug('Workstation not found for deletion', { name });
    return false;
  }

  // Delete associated events first (to satisfy foreign key constraint)
  const eventsStmt = db.prepare('DELETE FROM workstation_events WHERE workstation_id = ?');
  eventsStmt.run(ws.id);

  // Then delete the workstation
  const stmt = db.prepare('DELETE FROM workstations WHERE name = ?');
  const result = stmt.run(name);

  logger.debug('Workstation deleted', { name, changes: result.changes });

  return result.changes > 0;
}

// ============================================================
// Workstation Events
// ============================================================

/**
 * Create event log entry
 */
export function createEvent(event: Omit<WorkstationEvent, 'id' | 'timestamp'>): WorkstationEvent {
  const id = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO workstation_events (
      id, workstation_id, event_type, old_status, new_status, details, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    event.workstation_id,
    event.event_type,
    event.old_status,
    event.new_status,
    event.details,
    timestamp
  );

  return { id, ...event, timestamp };
}

/**
 * Get events for a workstation
 */
export function getWorkstationEvents(workstationId: string, limit = 50): WorkstationEvent[] {
  const stmt = db.prepare(`
    SELECT * FROM workstation_events
    WHERE workstation_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(workstationId, limit) as WorkstationEvent[];
}

// Initialize database on import
initializeDatabase();
