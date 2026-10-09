import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import {
  CallFiltersBar,
  CallsTable,
  STATUS_LABEL,
  useListCallsQuery,
  type CallFilters,
  type CallStatus,
} from '../features/calls';
import { useListClientsQuery } from '../features/clients';
import { useListCoachesQuery } from '../features/coaches';
import { useLivePollInterval } from '../features/live';

const isCallStatus = (value: string | null): value is CallStatus =>
  value !== null && value in STATUS_LABEL;

/** Filters live in the URL so coach/client pages can link to them */
const readFilters = (params: URLSearchParams): CallFilters => {
  const status = params.get('status');
  return {
    status: isCallStatus(status) ? status : undefined,
    coachId: params.get('coachId') ?? undefined,
    clientId: params.get('clientId') ?? undefined,
  };
};

export const CallsPage = () => {
  const pollingInterval = useLivePollInterval();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);

  const calls = useListCallsQuery(filters, { pollingInterval });
  const { data: coaches = [] } = useListCoachesQuery();
  const { data: clients = [] } = useListClientsQuery();

  const handleFiltersChange = (next: CallFilters) => {
    const entries = Object.entries(next).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    );
    setParams(new URLSearchParams(entries), { replace: true });
  };

  return (
    <>
      <PageHeader
        title='Calls'
        subtitle='Every coaching call from Grain, with its summary and pipeline status.'
      />
      <Panel
        title={calls.data ? `${calls.data.length} calls` : 'Calls'}
        actions={
          <CallFiltersBar
            filters={filters}
            coaches={coaches}
            clients={clients}
            onChange={handleFiltersChange}
          />
        }
      >
        <QueryState isLoading={calls.isLoading} error={calls.error}>
          <CallsTable
            calls={calls.data ?? []}
            onSelect={(id) => navigate(`/calls/${id}`)}
            emptyTitle='No calls match'
            emptyDescription='Use "Simulate call" in the top bar to send a mock Grain recording through the pipeline.'
          />
        </QueryState>
      </Panel>
    </>
  );
};
