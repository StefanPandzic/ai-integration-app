import { Button, Grid, SimpleGrid, VStack } from '@chakra-ui/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BackLink,
  EmptyState,
  PageHeader,
  Panel,
  QueryState,
  StatCard,
} from '../components';
import { CallsTable } from '../features/calls';
import { ClientsTable } from '../features/clients';
import { useGetCoachQuery } from '../features/coaches';
import { LIVE_POLL_MS } from '../store/api';

export const CoachDetailPage = () => {
  const { coachId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetCoachQuery(coachId, {
    pollingInterval: LIVE_POLL_MS,
  });
  const coach = data?.coach;

  return (
    <>
      <PageHeader
        eyebrow={<BackLink to='/coaches' label='Coaches' />}
        title={coach?.name ?? 'Coach'}
        subtitle={coach?.email}
      />
      <QueryState isLoading={isLoading} error={error}>
        {data && coach && (
          <VStack align='stretch' spacing={6}>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4}>
              <StatCard label='Clients' value={coach.client_count} />
              <StatCard label='Calls (last 7 days)' value={coach.calls_last_7_days} />
              <StatCard label='Calls total' value={coach.call_count} />
            </SimpleGrid>

            <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
              <Panel title='Clients'>
                <ClientsTable
                  clients={data.clients}
                  showCoach={false}
                  onSelect={(id) => navigate(`/clients/${id}`)}
                />
              </Panel>

              <Panel title='Weekly report'>
                <EmptyState
                  title='No reports yet'
                  description='Weekly coach reports (client progress, coaching rating and improvements) are generated from call summaries every Monday.'
                />
              </Panel>
            </Grid>

            <Panel
              title='Recent calls'
              actions={
                <Button as={Link} to={`/calls?coachId=${coach.id}`} size='sm' variant='ghost'>
                  View all
                </Button>
              }
            >
              <CallsTable
                calls={data.calls}
                showCoach={false}
                onSelect={(id) => navigate(`/calls/${id}`)}
              />
            </Panel>
          </VStack>
        )}
      </QueryState>
    </>
  );
};
