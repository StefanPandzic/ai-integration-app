/**
 * Outbox API (RTK Query endpoints for /api/outbox; read-only)
 */

import { api } from '../../../store/api';
import type { OutboxFilters, OutboxItem } from '../types';

export const outboxApi = api.injectEndpoints({
  endpoints: (build) => ({
    listOutbox: build.query<OutboxItem[], OutboxFilters | void>({
      query: (filters) => ({ url: '/api/outbox', params: filters ?? {} }),
      transformResponse: (response: { items: OutboxItem[] }) => response.items,
      providesTags: ['Outbox'],
    }),

    getOutboxItem: build.query<OutboxItem, string>({
      query: (id) => `/api/outbox/${id}`,
      transformResponse: (response: { item: OutboxItem }) => response.item,
      providesTags: (_result, _error, id) => [{ type: 'Outbox', id }],
    }),
  }),
});

export const { useListOutboxQuery, useGetOutboxItemQuery } = outboxApi;
