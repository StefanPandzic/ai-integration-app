/**
 * useCalls
 *
 * Polls the backend call list and exposes demo actions (simulate a call,
 * resolve a review-queue call). Server data stays in hook state rather
 * than Redux: it is refetched every few seconds and must not be persisted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '../../logging';
import { CallsService } from '../services/callsService';
import type {
  CallDetail,
  CallListItem,
  ClientOption,
  DemoInfo,
} from '../types';

const logger = createLogger('calls');
const POLL_INTERVAL_MS = 3000;

export const useCalls = () => {
  const serviceRef = useRef(CallsService());

  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [demoInfo, setDemoInfo] = useState<DemoInfo | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCalls(await serviceRef.current.listCalls());
      setError(null);
    } catch (err) {
      logger.error('Failed to load calls:', err);
      setError('Backend unreachable or database not configured');
    }
  }, []);

  useEffect(() => {
    const service = serviceRef.current;
    service.getDemoInfo().then(setDemoInfo).catch((err) => {
      logger.error('Failed to load demo info:', err);
    });
    service.listClients().then(setClients).catch((err) => {
      logger.error('Failed to load clients:', err);
    });

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refetch the detail view whenever the selected call changes status
  const selectedStatus = calls.find((c) => c.id === selectedCallId)?.status;
  useEffect(() => {
    if (!selectedCallId) {
      setSelectedCall(null);
      return;
    }
    serviceRef.current
      .getCall(selectedCallId)
      .then(setSelectedCall)
      .catch((err) => logger.error('Failed to load call:', err));
  }, [selectedCallId, selectedStatus]);

  const simulateCall = useCallback(
    async (sampleId: string | null) => {
      setIsSimulating(true);
      try {
        const { jobId } = await serviceRef.current.simulateCall(sampleId);
        logger.info('Simulated call queued as job', jobId);
        await refresh();
      } catch (err) {
        logger.error('Simulate call failed:', err);
        setError(err instanceof Error ? err.message : 'Simulate call failed');
      } finally {
        setIsSimulating(false);
      }
    },
    [refresh],
  );

  const assignCall = useCallback(
    async (callId: string, clientId: string) => {
      try {
        await serviceRef.current.assignCall(callId, clientId);
        await refresh();
      } catch (err) {
        logger.error('Assign call failed:', err);
        setError(err instanceof Error ? err.message : 'Assign call failed');
      }
    },
    [refresh],
  );

  return {
    calls,
    demoInfo,
    clients,
    selectedCallId,
    selectedCall,
    isSimulating,
    error,
    selectCall: setSelectedCallId,
    simulateCall,
    assignCall,
  };
};
