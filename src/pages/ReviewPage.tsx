import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import {
  ReviewQueueList,
  useAssignCall,
  useListCallsQuery,
} from '../features/calls';
import { useListClientsQuery } from '../features/clients';
import { useListCoachesQuery } from '../features/coaches';
import { useSlackChannels } from '../features/slack';
import { LIVE_POLL_MS } from '../store/api';

export const ReviewPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const calls = useListCallsQuery(
    { status: 'needs_review' },
    { pollingInterval: LIVE_POLL_MS },
  );
  const { data: clients = [] } = useListClientsQuery();
  const { data: coaches = [] } = useListCoachesQuery();
  const slackChannels = useSlackChannels();
  const { assignCall, assigningCallId } = useAssignCall();

  return (
    <>
      <PageHeader
        title='Review queue'
        subtitle='Calls the pipeline could not match to a client. Nothing is posted to Slack until you assign them.'
      />
      <Panel>
        <QueryState isLoading={calls.isLoading} error={calls.error}>
          <ReviewQueueList
            calls={calls.data ?? []}
            clients={clients}
            coaches={coaches}
            slackChannels={slackChannels}
            assigningCallId={assigningCallId}
            highlightCallId={params.get('call')}
            onAssign={assignCall}
            onOpen={(id) => navigate(`/calls/${id}`)}
          />
        </QueryState>
      </Panel>
    </>
  );
};
