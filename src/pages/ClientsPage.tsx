import { useNavigate } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import { ClientsTable, useListClientsQuery } from '../features/clients';
import { useLivePollInterval } from '../features/live';

export const ClientsPage = () => {
  const pollingInterval = useLivePollInterval();
  const navigate = useNavigate();
  const clients = useListClientsQuery(undefined, { pollingInterval });

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
