/**
 * Calls API (RTK Query endpoints for /api/calls and /api/demo)
 */

import { api } from '../../../store/api';
import type {
  AssignTarget,
  CallDetail,
  CallFilters,
  CallListItem,
  DemoInfo,
  DemoSwitch,
  SimulatedCall,
} from '../types';

export const callsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listCalls: build.query<CallListItem[], CallFilters | void>({
      query: (filters) => ({ url: '/api/calls', params: filters ?? {} }),
      transformResponse: (response: { calls: CallListItem[] }) =>
        response.calls,
      providesTags: (calls = []) => [
        { type: 'Call', id: 'LIST' },
        ...calls.map((call) => ({ type: 'Call' as const, id: call.id })),
      ],
    }),

    getCall: build.query<CallDetail, string>({
      query: (id) => `/api/calls/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Call', id }],
    }),

    assignCall: build.mutation<void, { callId: string; target: AssignTarget }>({
      query: ({ callId, target }) => ({
        url: `/api/calls/${callId}/assign`,
        method: 'POST',
        body: target,
      }),
      invalidatesTags: (_result, _error, { callId }) => [
        { type: 'Call', id: 'LIST' },
        { type: 'Call', id: callId },
        'Client',
        'Coach',
      ],
    }),

    getDemoInfo: build.query<DemoInfo, void>({
      query: () => '/api/demo/samples',
      providesTags: ['Demo'],
    }),

    simulateCall: build.mutation<SimulatedCall, string | null>({
      query: (sampleId) => ({
        url: '/api/demo/simulate-call',
        method: 'POST',
        body: sampleId ? { sampleId } : {},
      }),
      // Demo: a simulated call uses up an armed "drop next webhook"
      invalidatesTags: [{ type: 'Call', id: 'LIST' }, 'Client', 'Coach', 'Demo'],
    }),

    setDemoSwitch: build.mutation<void, { name: DemoSwitch; enabled: boolean }>({
      query: ({ name, enabled }) => ({
        url: `/api/demo/${name}`,
        method: 'POST',
        body: { enabled },
      }),
      invalidatesTags: ['Demo'],
    }),

    simulateWeek: build.mutation<
      { count: number; periodStart: string; periodEnd: string },
      number | null
    >({
      query: (count) => ({
        url: '/api/demo/simulate-week',
        method: 'POST',
        body: count ? { count } : {},
      }),
      invalidatesTags: [{ type: 'Call', id: 'LIST' }, 'Client', 'Coach'],
    }),
  }),
});

export const {
  useListCallsQuery,
  useGetCallQuery,
  useAssignCallMutation,
  useGetDemoInfoQuery,
  useSimulateCallMutation,
  useSimulateWeekMutation,
  useSetDemoSwitchMutation,
} = callsApi;
