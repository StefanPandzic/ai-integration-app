import { HStack } from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackLink, PageHeader, QueryState } from '../components';
import {
  CallDetailView,
  CallStatusBadge,
  callDate,
  formatDateTime,
  useAssignCall,
  useCallDetail,
} from '../features/calls';
import { useListClientsQuery } from '../features/clients';
import { useRetryJob } from '../features/pipeline';

export const CallDetailPage = () => {
  const { callId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useCallDetail(callId);
  const { data: clients = [] } = useListClientsQuery();
  const { assignCall, assigningCallId } = useAssignCall();
  const { retryJob, retryingJobId } = useRetryJob();

  return (
    <>
      <PageHeader
        eyebrow={<BackLink to='/calls' label='Calls' />}
        title={data ? (data.call.title ?? 'Untitled call') : 'Call'}
        subtitle={
          data &&
          [data.client?.name ?? 'Unmatched', data.coach?.name, formatDateTime(callDate(data.call))]
            .filter(Boolean)
            .join(' · ')
        }
        actions={
          data && (
            <HStack>
              <CallStatusBadge status={data.call.status} jobStatus={data.job?.status} />
            </HStack>
          )
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {data && (
          <CallDetailView
            detail={data}
            clients={clients}
            isAssigning={assigningCallId === data.call.id}
            isRetrying={retryingJobId !== null && retryingJobId === data.job?.id}
            onAssign={(clientId) => assignCall(data.call.id, clientId)}
            onRetry={(jobId) => retryJob(jobId, data.call.id)}
            onOpenClient={(id) => navigate(`/clients/${id}`)}
            onOpenCoach={(id) => navigate(`/coaches/${id}`)}
            onOpenOutboxItem={(service, id) => navigate(`/outbox?tab=${service}&item=${id}`)}
          />
        )}
      </QueryState>
    </>
  );
};
