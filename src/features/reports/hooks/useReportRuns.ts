/**
 * useReportRuns
 *
 * Recent report runs and the schedule. Polls only while a run is in
 * progress; each time a run makes progress (a coach report or the
 * manager report lands) the cached reports are refetched.
 */

import { useEffect, useRef, useState } from 'react';
import { api, LIVE_POLL_MS } from '../../../store/api';
import { useAppDispatch } from '../../../store/hooks';
import { useListReportRunsQuery } from '../services/reportsApi';
import type { ReportRuns } from '../types';

const progressKey = (data: ReportRuns): string =>
  data.runs
    .map((r) => `${r.run_id}:${r.state}:${r.coach_jobs.succeeded}:${r.manager_job}`)
    .join('|');

export const useReportRuns = () => {
  const dispatch = useAppDispatch();
  const [isRunning, setIsRunning] = useState(false);
  const lastProgress = useRef<string | null>(null);

  const query = useListReportRunsQuery(undefined, {
    pollingInterval: isRunning ? LIVE_POLL_MS : 0,
  });

  const { data } = query;
  useEffect(() => {
    if (!data) return;
    const progress = progressKey(data);
    if (lastProgress.current !== null && lastProgress.current !== progress) {
      dispatch(api.util.invalidateTags(['Report', 'Coach', 'Outbox']));
    }
    lastProgress.current = progress;
    setIsRunning(data.runs.some((r) => r.state === 'running'));
  }, [data, dispatch]);

  return {
    ...query,
    isRunning,
    latestRun: data?.runs[0] ?? null,
    schedule: data?.schedule ?? null,
  };
};
