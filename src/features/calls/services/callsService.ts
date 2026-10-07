/**
 * Calls API Service (Frontend)
 *
 * REST client for the backend call pipeline (/api/calls, /api/demo).
 */

import type {
  CallDetail,
  CallListItem,
  ClientOption,
  DemoInfo,
} from '../types';

export const CallsService = () => {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  };

  const listCalls = async (): Promise<CallListItem[]> =>
    (await request<{ calls: CallListItem[] }>('/api/calls')).calls;

  const getCall = (id: string): Promise<CallDetail> =>
    request<CallDetail>(`/api/calls/${id}`);

  const listClients = async (): Promise<ClientOption[]> =>
    (await request<{ clients: ClientOption[] }>('/api/clients')).clients;

  const getDemoInfo = (): Promise<DemoInfo> =>
    request<DemoInfo>('/api/demo/samples');

  const simulateCall = (sampleId: string | null): Promise<{ jobId: string }> =>
    request('/api/demo/simulate-call', {
      method: 'POST',
      body: JSON.stringify(sampleId ? { sampleId } : {}),
    });

  const assignCall = (callId: string, clientId: string): Promise<void> =>
    request(`/api/calls/${callId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });

  return {
    listCalls,
    getCall,
    listClients,
    getDemoInfo,
    simulateCall,
    assignCall,
  };
};
