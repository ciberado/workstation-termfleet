import { getAllWorkstations, updateWorkstation, deleteWorkstation, createEvent } from '../db/index.js';
import { applyStateMachine, shouldRemoveWorkstation } from '../services/stateMachine.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { WorkstationEventType, WorkstationStatus } from '../../shared/types.js';

/**
 * Perform health check on a single workstation
 */
async function checkWorkstationHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.healthCheckTimeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // Allow self-signed certificates in development
      // @ts-ignore
      ...(config.nodeEnv === 'development' && { rejectUnauthorized: false }),
    });

    clearTimeout(timeoutId);

    return response.status === 200;
  } catch (error) {
    // Timeout, network error, or non-200 response
    logger.debug('Health check failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Run health check job for all workstations
 */
export async function runHealthCheckJob(): Promise<void> {
  logger.debug('Starting health check job');

  const startTime = Date.now();

  try {
    // Get all workstations except terminated/removed
    const workstations = getAllWorkstations();

    // Filter out those that should be removed
    const toRemove: string[] = [];
    const toCheck = workstations.filter((ws) => {
      if (shouldRemoveWorkstation(ws)) {
        toRemove.push(ws.name);
        return false;
      }
      return true;
    });

    // Remove terminated workstations
    for (const name of toRemove) {
      deleteWorkstation(name);
      logger.info('Workstation removed', { name, reason: 'terminated_for_50_minutes' });
    }

    // Perform health checks in parallel
    const healthCheckPromises = toCheck.map(async (ws) => {
      if (!ws.domain_name) {
        return { ws, success: false };
      }

      const url = `https://${ws.domain_name}/`;
      const success = await checkWorkstationHealth(url);

      return { ws, success };
    });

    const results = await Promise.all(healthCheckPromises);

    // Apply state machine to each result
    for (const { ws, success } of results) {
      const transition = applyStateMachine(ws, success);

      if (transition) {
        const oldStatus = ws.status;
        const newStatus = transition.newStatus;

        // Update workstation
        updateWorkstation(ws.name, transition.updates);

        // Log event if status changed
        if (oldStatus !== newStatus) {
          createEvent({
            workstation_id: ws.id,
            event_type: WorkstationEventType.STATUS_CHANGED,
            old_status: oldStatus,
            new_status: newStatus,
            details: `Health check: ${success ? 'success' : 'failed'}`,
          });

          logger.info('Workstation status changed', {
            name: ws.name,
            oldStatus,
            newStatus,
            healthCheck: success,
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.debug('Health check job completed', {
      workstationsChecked: results.length,
      workstationsRemoved: toRemove.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error('Health check job failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
