import { Button, Grid, GridItem, HStack, Heading, Select, VStack, useDisclosure } from '@chakra-ui/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, PageHeader, Panel, QueryState } from '../components';
import { useAppColors } from '../constants/colors';
import {
  CoachReportsTable,
  ManagerReportView,
  RerunWeekDialog,
  RunStatusPanel,
  formatPeriod,
  periodEnd,
  useGetReportQuery,
  useListReportsQuery,
  useReportRuns,
  useRunReports,
} from '../features/reports';

/** Monitoring first: schedule and run state, then the selected week's reports */
export const ReportsPage = () => {
  const colors = useAppColors();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rerunDialog = useDisclosure();

  const runs = useReportRuns();
  const { runReports, isStarting } = useRunReports();
  const managerReports = useListReportsQuery({ type: 'manager' });

  // Weeks with a manager report, newest first
  const periods = [...new Set((managerReports.data ?? []).map((r) => r.period_start))];
  const period = params.get('period') ?? periods[0] ?? null;

  const weekReports = useListReportsQuery(period ? { periodStart: period } : skipToken);
  const manager = weekReports.data?.find((r) => r.type === 'manager') ?? null;
  const coachReports = (weekReports.data ?? []).filter((r) => r.type === 'coach');
  const managerDetail = useGetReportQuery(manager?.id ?? skipToken);
  const managerReport = managerDetail.data?.report;

  const handleRerun = async (periodStart: string | undefined) => {
    if (await runReports(periodStart)) rerunDialog.onClose();
  };

  return (
    <>
      <PageHeader
        title='Reports'
        subtitle='Weekly coach reports and the manager roll-up, delivered every Monday at 7:00 CT.'
        actions={
          periods.length > 0 && period ? (
            <Select
              size='sm'
              w='200px'
              bg={colors.bgSurface}
              value={period}
              onChange={(e) => setParams({ period: e.target.value }, { replace: true })}
            >
              {periods.map((start) => (
                <option key={start} value={start}>
                  Week of {formatPeriod(start, periodEnd(start))}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      <VStack align='stretch' spacing={6}>
        <RunStatusPanel schedule={runs.schedule} latestRun={runs.latestRun} onRerun={rerunDialog.onOpen} />

        <QueryState isLoading={managerReports.isLoading || runs.isLoading} error={managerReports.error ?? runs.error}>
          {!period ? (
            <Panel>
              <EmptyState
                title='No reports yet'
                description='The first run happens automatically on Monday at 7:00 CT (or at startup if a Monday was missed). In demo mode, use "Simulate week" and then rerun last week.'
              />
            </Panel>
          ) : (
            <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 2fr) minmax(300px, 1fr)' }} gap={6} alignItems='start'>
              <GridItem minW={0}>
                <VStack align='stretch' spacing={4}>
                  <HStack justify='space-between'>
                    <Heading size='md' color={colors.heading}>
                      Manager overview
                    </Heading>
                    {manager && (
                      <Button size='sm' variant='ghost' onClick={() => navigate(`/reports/${manager.id}`)}>
                        Open report
                      </Button>
                    )}
                  </HStack>
                  <QueryState isLoading={managerDetail.isLoading || weekReports.isLoading} error={managerDetail.error}>
                    {managerReport?.type === 'manager' ? (
                      <ManagerReportView
                        status={managerReport.status}
                        content={managerReport.content}
                        onOpenClient={(id) => navigate(`/clients/${id}`)}
                        onOpenCoach={(id) => navigate(`/coaches/${id}`)}
                        onOpenReport={(id) => navigate(`/reports/${id}`)}
                      />
                    ) : (
                      <Panel>
                        <EmptyState
                          title='Manager report not ready'
                          description='It is generated once every coach report for the week is done.'
                        />
                      </Panel>
                    )}
                  </QueryState>
                </VStack>
              </GridItem>
              <GridItem minW={0} position={{ xl: 'sticky' }} top={{ xl: 20 }}>
                <Panel title='Coach reports'>
                  <CoachReportsTable reports={coachReports} onSelect={(id) => navigate(`/reports/${id}`)} />
                </Panel>
              </GridItem>
            </Grid>
          )}
        </QueryState>
      </VStack>

      <RerunWeekDialog
        isOpen={rerunDialog.isOpen}
        periods={periods}
        defaultPeriod={period}
        isStarting={isStarting}
        onClose={rerunDialog.onClose}
        onConfirm={handleRerun}
      />
    </>
  );
};
