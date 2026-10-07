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

export const CallDetailPage = () => {
  const { callId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useCallDetail(callId);
  const { data: clients = [] } = useListClientsQuery();
  const { assignCall, assigningCallId } = useAssignCall();

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
            onAssign={(clientId) => assignCall(data.call.id, clientId)}
            onOpenClient={(id) => navigate(`/clients/${id}`)}
            onOpenCoach={(id) => navigate(`/coaches/${id}`)}
            onOpenOutboxItem={(id) => navigate(`/outbox?tab=slack&item=${id}`)}
          />
        )}
      </QueryState>
    </>
  );
};
