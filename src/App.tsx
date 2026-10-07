import { useColorMode, useToast } from '@chakra-ui/react';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  useGetDemoInfoQuery,
  useListCallsQuery,
  useSimulateCallMutation,
  useSimulateWeekMutation,
} from './features/calls';
import { AppShell } from './features/layout';
import { createLogger } from './features/logging';
import {
  CallDetailPage,
  CallsPage,
  ClientDetailPage,
  ClientsPage,
  CoachDetailPage,
  CoachesPage,
  NotFoundPage,
  OutboxPage,
  ReportDetailPage,
  ReportsPage,
  ReviewPage,
} from './pages';
import { LIVE_POLL_MS, getErrorMessage } from './store/api';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { toggleColorMode } from './store/slices/appSlice';

const logger = createLogger('app');

function App() {
  const dispatch = useAppDispatch();
  const toast = useToast();

  // Color mode lives in Redux (persisted); Chakra follows it
  const colorMode = useAppSelector((state) => state.app.colorMode);
  const { setColorMode } = useColorMode();
  useEffect(() => {
    setColorMode(colorMode);
  }, [colorMode, setColorMode]);

  const { data: demoInfo = null } = useGetDemoInfoQuery();
  const { data: reviewCalls = [] } = useListCallsQuery(
    { status: 'needs_review' },
    { pollingInterval: LIVE_POLL_MS },
  );
  const [simulateCall, { isLoading: isSimulating }] = useSimulateCallMutation();
  const [simulateWeek, { isLoading: isSimulatingWeek }] = useSimulateWeekMutation();

  const handleSimulate = async (sampleId: string | null) => {
    try {
      const { duplicate } = await simulateCall(sampleId).unwrap();
      toast({
        status: duplicate ? 'info' : 'success',
        title: duplicate ? 'Recording already received' : 'Mock Grain call sent',
        description: duplicate ? undefined : 'It appears in Calls as soon as the worker picks it up.',
      });
    } catch (error) {
      logger.error('Simulate call failed:', error);
      toast({
        status: 'error',
        title: 'Simulate call failed',
        description: getErrorMessage(error),
      });
    }
  };

  const handleSimulateWeek = async (count: number | null) => {
    try {
      const result = await simulateWeek(count).unwrap();
      toast({
        status: 'success',
        title: `${result.count} mock calls sent for last week`,
        description:
          'They are summarized as the worker gets to them. Then rerun last week from Reports (or wait for Monday 7:00 CT).',
      });
    } catch (error) {
      logger.error('Simulate week failed:', error);
      toast({
        status: 'error',
        title: 'Simulate week failed',
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <AppShell
      reviewCount={reviewCalls.length}
      demoInfo={demoInfo}
      isSimulating={isSimulating}
      isSimulatingWeek={isSimulatingWeek}
      colorMode={colorMode}
      onSimulate={handleSimulate}
      onSimulateWeek={handleSimulateWeek}
      onToggleColorMode={() => dispatch(toggleColorMode())}
    >
      <Routes>
        <Route path='/' element={<Navigate to='/calls' replace />} />
        <Route path='/calls' element={<CallsPage />} />
        <Route path='/calls/:callId' element={<CallDetailPage />} />
        <Route path='/review' element={<ReviewPage />} />
        <Route path='/clients' element={<ClientsPage />} />
        <Route path='/clients/:clientId' element={<ClientDetailPage />} />
        <Route path='/coaches' element={<CoachesPage />} />
        <Route path='/coaches/:coachId' element={<CoachDetailPage />} />
        <Route path='/reports' element={<ReportsPage />} />
        <Route path='/reports/:reportId' element={<ReportDetailPage />} />
        <Route path='/outbox' element={<OutboxPage />} />
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
