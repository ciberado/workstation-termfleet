import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { STATE_TRANSITIONS, applyStateMachine, shouldRemoveWorkstation } from '../stateMachine';
import { Workstation, WorkstationStatus } from '../../../shared/types';

describe('State Machine', () => {
  describe('STATE_TRANSITIONS', () => {
    it('should have all required transitions', () => {
      const transitionMap = new Map<string, number>();

      for (const transition of STATE_TRANSITIONS) {
        const key = `${transition.from}->${transition.to}`;
        transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
      }

      // Verify key transitions exist
      expect(transitionMap.has('starting->online')).toBe(true);
      expect(transitionMap.has('starting->unknown')).toBe(true);
      expect(transitionMap.has('online->online')).toBe(true);
      expect(transitionMap.has('online->unknown')).toBe(true);
      expect(transitionMap.has('unknown->online')).toBe(true);
      expect(transitionMap.has('unknown->terminated')).toBe(true);
    });
  });

  describe('applyStateMachine', () => {
    const now = new Date().toISOString();

    it('should transition starting -> online on successful health check', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.STARTING,
        created_at: now,
        last_check: null,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, true);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.ONLINE);
      expect(result?.last_check).toBeDefined();
      expect(result?.unknown_since).toBe(null);
    });

    it('should transition starting -> unknown after 10 minutes', () => {
      const tenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.STARTING,
        created_at: tenMinutesAgo,
        last_check: null,
        state_changed_at: tenMinutesAgo,
        dns_error: null,
        started_at: tenMinutesAgo,
        unknown_since: null,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, false);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.UNKNOWN);
      expect(result?.unknown_since).toBeDefined();
    });

    it('should not transition starting -> unknown before 10 minutes', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.STARTING,
        created_at: fiveMinutesAgo,
        last_check: null,
        state_changed_at: fiveMinutesAgo,
        dns_error: null,
        started_at: fiveMinutesAgo,
        unknown_since: null,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, false);

      expect(result).toBeNull();
    });

    it('should transition online -> unknown after 1 minute', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.ONLINE,
        created_at: now,
        last_check: twoMinutesAgo,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, false);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.UNKNOWN);
    });

    it('should keep online -> online on successful health check', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.ONLINE,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, true);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.ONLINE);
      expect(result?.last_check).toBeDefined();
    });

    it('should transition unknown -> online on recovery', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.UNKNOWN,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: now,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, true);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.ONLINE);
      expect(result?.unknown_since).toBe(null);
    });

    it('should transition unknown -> terminated after 10 minutes', () => {
      const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.UNKNOWN,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: elevenMinutesAgo,
        terminated_at: null,
      };

      const result = applyStateMachine(workstation, false);

      expect(result).toBeDefined();
      expect(result?.status).toBe(WorkstationStatus.TERMINATED);
      expect(result?.terminated_at).toBeDefined();
    });

    it('should return null when no transition applies', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.TERMINATED,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: now,
      };

      const result = applyStateMachine(workstation, false);

      expect(result).toBeNull();
    });
  });

  describe('shouldRemoveWorkstation', () => {
    const now = new Date().toISOString();

    it('should return true for terminated workstations after 50 minutes', () => {
      const fiftyOneMinutesAgo = new Date(Date.now() - 51 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.TERMINATED,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: fiftyOneMinutesAgo,
      };

      expect(shouldRemoveWorkstation(workstation)).toBe(true);
    });

    it('should return false for terminated workstations before 50 minutes', () => {
      const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString();

      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.TERMINATED,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: fortyMinutesAgo,
      };

      expect(shouldRemoveWorkstation(workstation)).toBe(false);
    });

    it('should return false for non-terminated workstations', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.ONLINE,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      };

      expect(shouldRemoveWorkstation(workstation)).toBe(false);
    });

    it('should return false for terminated without terminated_at', () => {
      const workstation: Workstation = {
        id: 1,
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.TERMINATED,
        created_at: now,
        last_check: now,
        state_changed_at: now,
        dns_error: null,
        started_at: now,
        unknown_since: null,
        terminated_at: null,
      };

      expect(shouldRemoveWorkstation(workstation)).toBe(false);
    });
  });
});
