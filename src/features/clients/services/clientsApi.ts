/**
 * Clients API (RTK Query endpoints for /api/clients)
 */

import { api } from '../../../store/api';
import type { SlackChannel } from '../../slack';
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

    updateClientChannel: build.mutation<
      { channel: SlackChannel },
      { clientId: string; slackChannelId: string }
    >({
      query: ({ clientId, slackChannelId }) => ({
        url: `/api/clients/${clientId}/slack-channel`,
        method: 'PATCH',
        body: { slackChannelId },
      }),
      // The bot may have joined the channel
      invalidatesTags: ['Client', 'SlackChannel'],
    }),
  }),
});

export const { useListClientsQuery, useGetClientQuery, useUpdateClientChannelMutation } =
  clientsApi;
