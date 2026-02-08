import { describe, it, expect, beforeEach } from '@jest/globals';
import { STATE_TRANSITIONS, applyStateMachine, shouldRemoveWorkstation } from './stateMachine.js';
import { Workstation, WorkstationStatus } from '../../shared/types.js';

describe('stateMachine', () => {
  let mockWorkstation: Workstation;

  describe('STATE_TRANSITIONS', () => {
    it('should have correct number of transitions', () => {
      expect(STATE_TRANSITIONS.length).toBe(6);
    });

    it('should have transitions for all critical paths', () => {
      const transitionPairs = STATE_TRANSITIONS.map((t) => `${t.from}->${t.to}`);
      
      expect(transitionPairs).toContain('starting->online');
      expect(transitionPairs).toContain('starting->unknown');
      expect(transitionPairs).toContain('online->online');
      expect(transitionPairs).toContain('online->unknown');
      expect(transitionPairs).toContain('unknown->online');
      expect(transitionPairs).toContain('unknown->terminated');
    });
  });

  describe('applyStateMachine', () => {
    beforeEach(() => {
      mockWorkstation = {
        id: 'ws-1',
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.STARTING,
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        last_check: null,
        state_changed_at: new Date().toISOString(),
        dns_error: null,
        started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        unknown_since: null,
        terminated_at: null,
      };
    });

    it('should transition STARTING→ONLINE on successful health check', () => {
      const result = applyStateMachine(mockWorkstation, true);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.ONLINE);
      expect(result?.updates.status).toBe(WorkstationStatus.ONLINE);
      expect(result?.updates.last_check).toBeDefined();
      expect(result?.updates.unknown_since).toBe(null);
    });

    it('should transition STARTING→UNKNOWN after 10 min timeout', () => {
      mockWorkstation.started_at = new Date(Date.now() - 11 * 60 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, false);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.UNKNOWN);
      expect(result?.updates.status).toBe(WorkstationStatus.UNKNOWN);
      expect(result?.updates.unknown_since).toBeDefined();
    });

    it('should stay STARTING if health check fails but timeout not reached', () => {
      mockWorkstation.started_at = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, false);

      expect(result).toBeNull();
    });

    it('should transition ONLINE→ONLINE on successful health check', () => {
      mockWorkstation.status = WorkstationStatus.ONLINE;
      mockWorkstation.last_check = new Date(Date.now() - 30 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, true);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.ONLINE);
      expect(result?.updates.last_check).toBeDefined();
    });

    it('should transition ONLINE→UNKNOWN after 1 min no response', () => {
      mockWorkstation.status = WorkstationStatus.ONLINE;
      mockWorkstation.last_check = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, false);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.UNKNOWN);
      expect(result?.updates.status).toBe(WorkstationStatus.UNKNOWN);
      expect(result?.updates.unknown_since).toBeDefined();
    });

    it('should transition UNKNOWN→ONLINE on successful health check (recovery)', () => {
      mockWorkstation.status = WorkstationStatus.UNKNOWN;
      mockWorkstation.unknown_since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, true);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.ONLINE);
      expect(result?.updates.status).toBe(WorkstationStatus.ONLINE);
      expect(result?.updates.last_check).toBeDefined();
      expect(result?.updates.unknown_since).toBe(null);
    });

    it('should transition UNKNOWN→TERMINATED after 10 min in unknown', () => {
      mockWorkstation.status = WorkstationStatus.UNKNOWN;
      mockWorkstation.unknown_since = new Date(Date.now() - 11 * 60 * 1000).toISOString();

      const result = applyStateMachine(mockWorkstation, false);

      expect(result).not.toBeNull();
      expect(result?.newStatus).toBe(WorkstationStatus.TERMINATED);
      expect(result?.updates.status).toBe(WorkstationStatus.TERMINATED);
      expect(result?.updates.terminated_at).toBeDefined();
    });

    it('should return null when no transition applies', () => {
      mockWorkstation.status = WorkstationStatus.TERMINATED;

      const result = applyStateMachine(mockWorkstation, true);

      expect(result).toBeNull();
    });
  });

  describe('shouldRemoveWorkstation', () => {
    beforeEach(() => {
      mockWorkstation = {
        id: 'ws-1',
        name: 'desk1',
        ip_address: '192.168.1.100',
        domain_name: 'desk1.ws.aprender.cloud',
        status: WorkstationStatus.TERMINATED,
        created_at: new Date().toISOString(),
        last_check: null,
        state_changed_at: new Date().toISOString(),
        dns_error: null,
        started_at: null,
        unknown_since: null,
        terminated_at: new Date(Date.now() - 51 * 60 * 1000).toISOString(),
      };
    });

    it('should return true for workstation terminated 50+ minutes ago', () => {
      const result = shouldRemoveWorkstation(mockWorkstation);
      expect(result).toBe(true);
    });

    it('should return false for workstation terminated < 50 minutes ago', () => {
      mockWorkstation.terminated_at = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const result = shouldRemoveWorkstation(mockWorkstation);
      expect(result).toBe(false);
    });

    it('should return false for non-terminated workstation', () => {
      mockWorkstation.status = WorkstationStatus.ONLINE;
      
      const result = shouldRemoveWorkstation(mockWorkstation);
      expect(result).toBe(false);
    });

    it('should return false for terminated workstation with null terminated_at', () => {
      mockWorkstation.terminated_at = null;
      
      const result = shouldRemoveWorkstation(mockWorkstation);
      expect(result).toBe(false);
    });
  });
});
