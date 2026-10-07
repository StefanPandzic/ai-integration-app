/**
 * Pipeline API (RTK Query endpoints for /api/pipeline and /api/jobs)
 */

import { api } from '../../../store/api';
import type { JobFeedItem, JobFilters, PipelineHealth } from '../types';

export const pipelineApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPipelineHealth: build.query<PipelineHealth, void>({
      query: () => '/api/pipeline/health',
      providesTags: ['Pipeline'],
    }),

    listJobs: build.query<JobFeedItem[], JobFilters | void>({
      query: (filters) => ({ url: '/api/jobs', params: filters ?? {} }),
      transformResponse: (response: { jobs: JobFeedItem[] }) => response.jobs,
      providesTags: ['Job'],
    }),

    retryJob: build.mutation<void, { jobId: string; callId?: string | null }>({
      query: ({ jobId }) => ({ url: `/api/jobs/${jobId}/retry`, method: 'POST' }),
      invalidatesTags: (_result, _error, { callId }) => [
        'Job',
        'Pipeline',
        'ReportRun',
        { type: 'Call', id: 'LIST' },
        ...(callId ? [{ type: 'Call' as const, id: callId }] : []),
      ],
    }),

    reconcileNow: build.mutation<{ jobId: string }, void>({
      query: () => ({ url: '/api/pipeline/reconcile', method: 'POST' }),
      invalidatesTags: ['Job', 'Pipeline', { type: 'Call', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPipelineHealthQuery,
  useListJobsQuery,
  useRetryJobMutation,
  useReconcileNowMutation,
} = pipelineApi;
