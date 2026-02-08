import { Router, Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/apiResponse.js';
import { validateRegistrationRequest } from '../utils/validation.js';
import {
  createWorkstation,
  getWorkstationByName,
  getAllWorkstations,
  updateWorkstation,
  createEvent,
} from '../db/index.js';
import { registerDnsRecord, checkDnsPropagation } from '../services/spaceship.js';
import {
  WorkstationStatus,
  ErrorCode,
  RegisterWorkstationRequest,
  WorkstationResponse,
  ListWorkstationsQuery,
  WorkstationEventType,
} from '../../shared/types.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/workstations/register
 * Register or update a workstation
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as RegisterWorkstationRequest;

    // Validate input
    const validation = validateRegistrationRequest(body);
    if (!validation.valid) {
      return sendError(res, validation.error!, validation.code!, 400);
    }

    const { name, ip } = body;
    const now = new Date().toISOString();

    // Check if workstation already exists
    const existing = getWorkstationByName(name);

    if (existing) {
      // Workstation exists - check if IP changed
      if (existing.ip_address === ip) {
        // Same IP, return existing (idempotent)
        const response: WorkstationResponse = {
          ...existing,
          ttyd_url: `https://${existing.domain_name}`,
        };
        return sendSuccess(res, response, 200);
      }

      // IP changed, update and re-register DNS
      try {
        const dnsResult = await registerDnsRecord(name, ip);

        updateWorkstation(name, {
          ip_address: ip,
          domain_name: dnsResult.domain,
          status: WorkstationStatus.STARTING,
          state_changed_at: now,
          started_at: now,
          dns_error: null,
          unknown_since: null,
          terminated_at: null,
        });

        // Log event
        createEvent({
          workstation_id: existing.id,
          event_type: WorkstationEventType.REGISTERED,
          old_status: existing.status,
          new_status: WorkstationStatus.STARTING,
          details: `IP changed from ${existing.ip_address} to ${ip}`,
        });

        const updated = getWorkstationByName(name)!;
        const response: WorkstationResponse = {
          ...updated,
          ttyd_url: `https://${updated.domain_name}`,
        };

        return sendSuccess(res, response, 200);
      } catch (error) {
        // DNS registration failed
        updateWorkstation(name, {
          status: WorkstationStatus.DNS_FAILED,
          dns_error: error instanceof Error ? error.message : String(error),
          state_changed_at: now,
        });

        return sendError(
          res,
          'Failed to register DNS domain',
          ErrorCode.DNS_REGISTRATION_FAILED,
          500,
          error instanceof Error ? error.message : undefined
        );
      }
    }

    // New workstation - register DNS and create
    try {
      const dnsResult = await registerDnsRecord(name, ip);

      const workstation = createWorkstation({
        name,
        ip_address: ip,
        domain_name: dnsResult.domain,
        status: WorkstationStatus.STARTING,
        created_at: now,
        last_check: null,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      });

      // Log event
      createEvent({
        workstation_id: workstation.id,
        event_type: WorkstationEventType.REGISTERED,
        old_status: null,
        new_status: WorkstationStatus.STARTING,
        details: 'Workstation registered',
      });

      const response: WorkstationResponse = {
        ...workstation,
        ttyd_url: `https://${workstation.domain_name}`,
      };

      return sendSuccess(res, response, 201);
    } catch (error) {
      // DNS registration failed - still create workstation with dns_failed status
      const workstation = createWorkstation({
        name,
        ip_address: ip,
        domain_name: `${name}.${config.baseDomain}`,
        status: WorkstationStatus.DNS_FAILED,
        created_at: now,
        last_check: null,
        state_changed_at: now,
        dns_error: error instanceof Error ? error.message : String(error),
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      });

      return sendError(
        res,
        'Failed to register DNS domain',
        ErrorCode.DNS_REGISTRATION_FAILED,
        500,
        error instanceof Error ? error.message : undefined
      );
    }
  })
);

/**
 * GET /api/workstations/:name/propagation
 * Check DNS propagation for a workstation
 */
router.get(
  '/:name/propagation',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    const workstation = getWorkstationByName(name);

    if (!workstation) {
      return sendError(res, 'Workstation not found', ErrorCode.NOT_FOUND, 404);
    }

    if (!workstation.domain_name) {
      return sendError(res, 'Workstation has no domain name', ErrorCode.INVALID_INPUT, 400);
    }

    const propagated = await checkDnsPropagation(workstation.domain_name);

    return sendSuccess(res, {
      name: workstation.name,
      domain_name: workstation.domain_name,
      propagated,
      checked_at: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/workstations
 * List all workstations with optional filtering and sorting
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, sort, order } = req.query as Partial<ListWorkstationsQuery>;

    const workstations = getAllWorkstations({
      status: status as WorkstationStatus | undefined,
      sort: sort as 'name' | 'status' | 'created_at' | 'last_check' | undefined,
      order: order as 'asc' | 'desc' | undefined,
    });

    const response: WorkstationResponse[] = workstations.map((ws) => ({
      ...ws,
      ttyd_url: `https://${ws.domain_name}`,
    }));

    return sendSuccess(res, response);
  })
);

/**
 * GET /api/workstations/:name
 * Get single workstation by name
 */
router.get(
  '/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    const workstation = getWorkstationByName(name);

    if (!workstation) {
      return sendError(res, 'Workstation not found', ErrorCode.NOT_FOUND, 404);
    }

    const response: WorkstationResponse = {
      ...workstation,
      ttyd_url: `https://${workstation.domain_name}`,
    };

    return sendSuccess(res, response);
  })
);

export default router;
