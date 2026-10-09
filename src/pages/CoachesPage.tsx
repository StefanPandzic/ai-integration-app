import { useNavigate } from 'react-router-dom';
import { PageHeader, QueryState } from '../components';
import { CoachCards, useListCoachesQuery } from '../features/coaches';
import { useLivePollInterval } from '../features/live';

export const CoachesPage = () => {
  const pollingInterval = useLivePollInterval();
  const navigate = useNavigate();
  const coaches = useListCoachesQuery(undefined, { pollingInterval });

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
