import { useNavigate } from 'react-router-dom';
import { PageHeader, QueryState } from '../components';
import { CoachCards, useListCoachesQuery } from '../features/coaches';
import { LIVE_POLL_MS } from '../store/api';

export const CoachesPage = () => {
  const navigate = useNavigate();
  const coaches = useListCoachesQuery(undefined, { pollingInterval: LIVE_POLL_MS });

  return (
    <>
      <PageHeader title='Coaches' subtitle='Coach rosters and recent activity.' />
      <QueryState isLoading={coaches.isLoading} error={coaches.error}>
        <CoachCards
          coaches={coaches.data ?? []}
          onSelect={(id) => navigate(`/coaches/${id}`)}
        />
      </QueryState>
    </>
  );
};
