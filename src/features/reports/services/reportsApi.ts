/**
 * Reports API (RTK Query endpoints for /api/reports)
 */

import { api } from '../../../store/api';
import type {
  ReportDetail,
  ReportFilters,
  ReportListItem,
  ReportRuns,
  RunHandle,
} from '../types';

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listReports: build.query<ReportListItem[], ReportFilters | void>({
      query: (filters) => ({ url: '/api/reports', params: filters ?? {} }),
      transformResponse: (response: { reports: ReportListItem[] }) =>
        response.reports,
      providesTags: ['Report'],
    }),

    getReport: build.query<ReportDetail, string>({
      query: (id) => `/api/reports/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Report', id }],
    }),

    listReportRuns: build.query<ReportRuns, void>({
      query: () => '/api/reports/runs',
      providesTags: ['ReportRun'],
    }),

    runReports: build.mutation<RunHandle, { periodStart?: string } | void>({
      query: (body) => ({
        url: '/api/reports/run',
        method: 'POST',
        body: body ?? {},
      }),
      invalidatesTags: ['ReportRun'],
    }),
  }),
});

export const {
  useListReportsQuery,
  useGetReportQuery,
  useListReportRunsQuery,
  useRunReportsMutation,
} = reportsApi;
