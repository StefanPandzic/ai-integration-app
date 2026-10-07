import { useNavigate } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import { ClientsTable, useListClientsQuery } from '../features/clients';
import { LIVE_POLL_MS } from '../store/api';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const clients = useListClientsQuery(undefined, { pollingInterval: LIVE_POLL_MS });

  return (
    <>
      <PageHeader title='Clients' subtitle='Everyone being coached, with their latest call.' />
      <Panel>
        <QueryState isLoading={clients.isLoading} error={clients.error}>
          <ClientsTable
            clients={clients.data ?? []}
            onSelect={(id) => navigate(`/clients/${id}`)}
          />
        </QueryState>
      </Panel>
    </>
  );
};
