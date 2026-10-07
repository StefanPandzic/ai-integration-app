/**
 * Clients API (RTK Query endpoints for /api/clients; read-only)
 */

import { api } from '../../../store/api';
import type { ClientDetail, ClientListItem } from '../types';

export const clientsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listClients: build.query<ClientListItem[], { coachId?: string } | void>({
      query: (params) => ({ url: '/api/clients', params: params ?? {} }),
      transformResponse: (response: { clients: ClientListItem[] }) =>
        response.clients,
      providesTags: ['Client'],
    }),

    getClient: build.query<ClientDetail, string>({
      query: (id) => `/api/clients/${id}`,
      providesTags: ['Client', { type: 'Call', id: 'LIST' }],
    }),
  }),
});

export const { useListClientsQuery, useGetClientQuery } = clientsApi;
