import {
  Badge,
  Button,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VStack,
} from '@chakra-ui/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import {
  FailuresList,
  JobFeedTable,
  QueueStats,
  useGetPipelineHealthQuery,
  useListJobsQuery,
  useReconcileNow,
  useRetryJob,
  type PipelineTab,
} from '../features/pipeline';
import { useLivePollInterval } from '../features/live';

const TABS: PipelineTab[] = ['live', 'failures'];
const FEED_SIZE = 50;
const FAILURES_SIZE = 100;

/**
 * Queue health, the live job feed and dead jobs with Retry. The tab lives
 * in the URL (?tab=failures) so ops alerts can link straight to it.
 */
export const PipelinePage = () => {
  const pollingInterval = useLivePollInterval();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: PipelineTab = params.get('tab') === 'failures' ? 'failures' : 'live';

  const health = useGetPipelineHealthQuery(undefined, { pollingInterval });
  const feed = useListJobsQuery({ limit: FEED_SIZE }, { pollingInterval });
  const failures = useListJobsQuery(
    { status: 'dead', limit: FAILURES_SIZE },
    { pollingInterval },
  );
  const { retryJob, retryingJobId } = useRetryJob();
  const { reconcileNow, isReconciling } = useReconcileNow();

  const deadCount = failures.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title='Pipeline'
        subtitle='The job queue behind every call and report. Failures alert ops in Slack; this page is for looking closer.'
        actions={
          <Button size='sm' variant='outline' isLoading={isReconciling} onClick={reconcileNow}>
            Reconcile now
          </Button>
        }
      />
      <VStack align='stretch' spacing={6}>
        <QueryState isLoading={health.isLoading} error={health.error}>
          {health.data && <QueueStats health={health.data} />}
        </QueryState>

        <Panel>
          <Tabs
            colorScheme='brand'
            index={TABS.indexOf(tab)}
            onChange={(index) => setParams({ tab: TABS[index] }, { replace: true })}
            isLazy
          >
            <TabList px={5}>
              <Tab py={3}>Live feed</Tab>
              <Tab py={3}>
                Failures
                {deadCount > 0 && (
                  <Badge ml={2} colorScheme='red' borderRadius='full'>
                    {deadCount}
                  </Badge>
                )}
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={0}>
                <QueryState isLoading={feed.isLoading} error={feed.error}>
                  <JobFeedTable jobs={feed.data ?? []} onOpen={navigate} />
                </QueryState>
              </TabPanel>
              <TabPanel p={0}>
                <QueryState isLoading={failures.isLoading} error={failures.error}>
                  <FailuresList
                    jobs={failures.data ?? []}
                    retryingJobId={retryingJobId}
                    onRetry={(job) => retryJob(job.id, job.call_id)}
                    onOpen={navigate}
                  />
                </QueryState>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Panel>
      </VStack>
    </>
  );
};
