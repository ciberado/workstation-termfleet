import { WorkstationStatus, Workstation } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Calculate time difference in milliseconds
 */
function timeDiff(timestamp: string | null): number | null {
  if (!timestamp) return null;
  return Date.now() - new Date(timestamp).getTime();
}

/**
 * State machine rules and transitions
 */
export interface StateTransition {
  from: WorkstationStatus;
  to: WorkstationStatus;
  condition: (ws: Workstation, healthCheckSuccess: boolean) => boolean;
  updateFields: (ws: Workstation) => Partial<Workstation>;
}

/**
 * All state transition rules
 */
export const STATE_TRANSITIONS: StateTransition[] = [
  // STARTING -> ONLINE (on successful health check)
  {
    from: WorkstationStatus.STARTING,
    to: WorkstationStatus.ONLINE,
    condition: (_ws, healthCheckSuccess) => healthCheckSuccess,
    updateFields: (_ws) => ({
      status: WorkstationStatus.ONLINE,
      last_check: new Date().toISOString(),
      state_changed_at: new Date().toISOString(),
      unknown_since: null,
    }),
  },

  // STARTING -> UNKNOWN (after 10 minutes with no successful check)
  {
    from: WorkstationStatus.STARTING,
    to: WorkstationStatus.UNKNOWN,
    condition: (ws, healthCheckSuccess) => {
      if (healthCheckSuccess) return false;
      const startedDiff = timeDiff(ws.started_at);
      return startedDiff !== null && startedDiff > 10 * 60 * 1000; // 10 minutes
    },
    updateFields: (_ws) => ({
      status: WorkstationStatus.UNKNOWN,
      state_changed_at: new Date().toISOString(),
      unknown_since: new Date().toISOString(),
    }),
  },

  // ONLINE -> ONLINE (successful health check)
  {
    from: WorkstationStatus.ONLINE,
    to: WorkstationStatus.ONLINE,
    condition: (_ws, healthCheckSuccess) => healthCheckSuccess,
    updateFields: (_ws) => ({
      last_check: new Date().toISOString(),
    }),
  },

  // ONLINE -> UNKNOWN (after 1 minute with no response)
  {
    from: WorkstationStatus.ONLINE,
    to: WorkstationStatus.UNKNOWN,
    condition: (ws, healthCheckSuccess) => {
      if (healthCheckSuccess) return false;
      const lastCheckDiff = timeDiff(ws.last_check);
      return lastCheckDiff !== null && lastCheckDiff > 1 * 60 * 1000; // 1 minute
    },
    updateFields: (_ws) => ({
      status: WorkstationStatus.UNKNOWN,
      state_changed_at: new Date().toISOString(),
      unknown_since: new Date().toISOString(),
    }),
  },

  // UNKNOWN -> ONLINE (successful health check - recovery)
  {
    from: WorkstationStatus.UNKNOWN,
    to: WorkstationStatus.ONLINE,
    condition: (_ws, healthCheckSuccess) => healthCheckSuccess,
    updateFields: (_ws) => ({
      status: WorkstationStatus.ONLINE,
      last_check: new Date().toISOString(),
      state_changed_at: new Date().toISOString(),
      unknown_since: null,
    }),
  },

  // UNKNOWN -> TERMINATED (after 10 minutes in unknown)
  {
    from: WorkstationStatus.UNKNOWN,
    to: WorkstationStatus.TERMINATED,
    condition: (ws, healthCheckSuccess) => {
      if (healthCheckSuccess) return false;
      const unknownDiff = timeDiff(ws.unknown_since);
      return unknownDiff !== null && unknownDiff > 10 * 60 * 1000; // 10 minutes
    },
    updateFields: (_ws) => ({
      status: WorkstationStatus.TERMINATED,
      state_changed_at: new Date().toISOString(),
      terminated_at: new Date().toISOString(),
    }),
  },
];

/**
 * Apply state machine logic to determine new state and updates
 */
export function applyStateMachine(
  workstation: Workstation,
  healthCheckSuccess: boolean
): { newStatus: WorkstationStatus; updates: Partial<Workstation> } | null {
  // Find applicable transition
  const transition = STATE_TRANSITIONS.find(
    (t) => t.from === workstation.status && t.condition(workstation, healthCheckSuccess)
  );

  if (!transition) {
    // No transition applies
    return null;
  }

  const updates = transition.updateFields(workstation);

  logger.debug('State transition applied', {
    workstation: workstation.name,
    from: transition.from,
    to: transition.to,
    healthCheckSuccess,
  });

  return {
    newStatus: transition.to,
    updates,
  };
}

/**
 * Check if workstation should be removed (terminated for 50 minutes)
 */
export function shouldRemoveWorkstation(workstation: Workstation): boolean {
  if (workstation.status !== WorkstationStatus.TERMINATED) {
    return false;
  }

  const terminatedDiff = timeDiff(workstation.terminated_at);
  return terminatedDiff !== null && terminatedDiff > 50 * 60 * 1000; // 50 minutes
}
