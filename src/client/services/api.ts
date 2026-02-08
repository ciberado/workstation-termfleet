import { Workstation, WorkstationStatus, ApiResponse } from '../../shared/types.js';

const API_BASE = '/api';

/**
 * Fetch all workstations with optional filtering
 */
export async function fetchWorkstations(params?: {
  status?: WorkstationStatus;
  sort?: string;
  order?: string;
}): Promise<Workstation[]> {
  const queryParams = new URLSearchParams();

  if (params?.status) queryParams.append('status', params.status);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.order) queryParams.append('order', params.order);

  const url = `${API_BASE}/workstations${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data: ApiResponse<Workstation[]> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch workstations');
  }

  return data.data;
}

/**
 * Fetch single workstation by name
 */
export async function fetchWorkstationByName(name: string): Promise<Workstation> {
  const response = await fetch(`${API_BASE}/workstations/${name}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data: ApiResponse<Workstation> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch workstation');
  }

  return data.data;
}

/**
 * Check DNS propagation for a workstation
 */
export async function checkPropagation(name: string): Promise<{
  name: string;
  domain_name: string;
  propagated: boolean;
  checked_at: string;
}> {
  const response = await fetch(`${API_BASE}/workstations/${name}/propagation`);

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data: ApiResponse = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to check propagation');
  }

  return data.data as any;
}
