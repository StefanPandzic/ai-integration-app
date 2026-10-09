import { Link as ChakraLink, SimpleGrid, VStack } from '@chakra-ui/react';
import { useAppColors } from '../constants/colors';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink, PageHeader, Panel, QueryState, StatCard } from '../components';
import { CallsTable, SentimentBadge, formatDate } from '../features/calls';
import {
  ClientChannelCard,
  ClientInsights,
  useGetClientQuery,
  useUpdateClientChannel,
} from '../features/clients';
import { useSlackChannels } from '../features/slack';
import { useLivePollInterval } from '../features/live';

export const ClientDetailPage = () => {
  const pollingInterval = useLivePollInterval();
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const colors = useAppColors();
  const { data, isLoading, error } = useGetClientQuery(clientId, {
    pollingInterval,
  });
  const client = data?.client;
  const slackChannels = useSlackChannels();
  const { updateChannel, isUpdatingChannel } = useUpdateClientChannel();

  return (
    <>
      <PageHeader
        eyebrow={<BackLink to='/clients' label='Clients' />}
        title={client?.name ?? 'Client'}
        subtitle={
          client && (
            <>
              {client.email ?? 'No email'}
              {client.coach_id && (
                <>
                  {' · Coached by '}
                  <ChakraLink as={Link} to={`/coaches/${client.coach_id}`} color={colors.textAccent}>
                    {client.coach_name}
                  </ChakraLink>
                </>
              )}
            </>
          )
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {data && client && (
          <VStack align='stretch' spacing={6}>
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              <StatCard label='Calls' value={client.call_count} />
              <StatCard label='Last call' value={formatDate(client.last_call_at)} />
              <StatCard
                label='Latest sentiment'
                value={client.latest_sentiment ? <SentimentBadge sentiment={client.latest_sentiment} /> : '—'}
              />
              <ClientChannelCard
                channelId={client.slack_channel_id}
                slackChannels={slackChannels}
                isSaving={isUpdatingChannel}
                onSave={(channelId) => updateChannel(client.id, channelId)}
              />
            </SimpleGrid>

            <ClientInsights summaries={data.summaries} />

            <Panel title='Calls'>
              <CallsTable
                calls={data.calls}
                showClient={false}
                onSelect={(id) => navigate(`/calls/${id}`)}
              />
            </Panel>
          </VStack>
        )}
      </QueryState>
    </>
  );
};
