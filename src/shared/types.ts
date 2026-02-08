/**
 * Shared TypeScript types and interfaces for Termfleet
 */

// ============================================================
// Workstation Status
// ============================================================

export enum WorkstationStatus {
  STARTING = 'starting',
  ONLINE = 'online',
  UNKNOWN = 'unknown',
  DNS_FAILED = 'dns_failed',
  TERMINATED = 'terminated',
}

// ============================================================
// Workstation Data Model
// ============================================================

export interface Workstation {
  id: string;
  name: string;
  ip_address: string;
  domain_name: string | null;
  status: WorkstationStatus;
  created_at: string; // ISO 8601 timestamp
  last_check: string | null; // ISO 8601 timestamp
  state_changed_at: string; // ISO 8601 timestamp
  dns_error: string | null;
  started_at: string | null; // ISO 8601 timestamp
  unknown_since: string | null; // ISO 8601 timestamp
  terminated_at: string | null; // ISO 8601 timestamp
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface RegisterWorkstationRequest {
  name: string;
  ip: string;
}

export interface WorkstationResponse extends Workstation {
  ttyd_url: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: string;
}

export interface ListWorkstationsQuery {
  status?: WorkstationStatus;
  sort?: 'name' | 'status' | 'created_at' | 'last_check';
  order?: 'asc' | 'desc';
}

export interface PropagationResponse {
  name: string;
  domain_name: string;
  propagated: boolean;
  checked_at: string;
}

// ============================================================
// Workstation Events
// ============================================================

export enum WorkstationEventType {
  REGISTERED = 'registered',
  STATUS_CHANGED = 'status_changed',
  HEALTH_CHECKED = 'health_checked',
  DNS_UPDATED = 'dns_updated',
  DNS_FAILED = 'dns_failed',
}

export interface WorkstationEvent {
  id: string;
  workstation_id: string;
  event_type: WorkstationEventType;
  old_status: WorkstationStatus | null;
  new_status: WorkstationStatus | null;
  details: string | null;
  timestamp: string; // ISO 8601 timestamp
}

// ============================================================
// Configuration
// ============================================================

export interface Config {
  port: number;
  nodeEnv: string;
  baseDomain: string;
  workstationCheckInterval: number;
  healthCheckTimeout: number;
  spaceshipApiKey: string;
  spaceshipApiSecret: string;
  logLevel: string;
  logDir: string;
  dbPath: string;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  dnsTtl: number;
}

// ============================================================
// Error Codes
// ============================================================

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE = 'DUPLICATE',
  DNS_REGISTRATION_FAILED = 'DNS_REGISTRATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
