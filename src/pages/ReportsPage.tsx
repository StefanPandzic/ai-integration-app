import { EmptyState, PageHeader, Panel } from '../components';

/** Placeholder until Phase 3 (weekly coach and manager reports) */
export const ReportsPage = () => (
  <>
    <PageHeader
      title='Reports'
      subtitle='Weekly coach reports and the manager roll-up.'
    />
    <Panel>
      <EmptyState
        title='Weekly reports are coming'
        description='Every Monday at 7:00 CT, each coach gets a report built from their call summaries, and managers get a roll-up of trends, sentiment and at-risk clients.'
      />
    </Panel>
  </>
);
