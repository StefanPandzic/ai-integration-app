/**
 * Coaches API (RTK Query endpoints for /api/coaches; read-only)
 */

import { api } from '../../../store/api';
import type { CoachDetail, CoachListItem } from '../types';

export const coachesApi = api.injectEndpoints({
  endpoints: (build) => ({
    listCoaches: build.query<CoachListItem[], void>({
      query: () => '/api/coaches',
      transformResponse: (response: { coaches: CoachListItem[] }) =>
        response.coaches,
      providesTags: ['Coach'],
    }),

    getCoach: build.query<CoachDetail, string>({
      query: (id) => `/api/coaches/${id}`,
      providesTags: ['Coach', 'Client', 'Report', { type: 'Call', id: 'LIST' }],
    }),
  }),
});

export const { useListCoachesQuery, useGetCoachQuery } = coachesApi;
