import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Link,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { AssignableClient, AssignableCoach, AssignTarget, CallDetail } from '../types';
import { callDate, formatDateTime, formatDuration } from '../utils/format';
import { CallStatusBadge } from './CallBadges';
import { CallSummaryView } from './CallSummaryView';
import { ReviewAssign } from './ReviewAssign';
import { TranscriptView } from './TranscriptView';

interface CallDetailViewProps {
  detail: CallDetail;
  clients: AssignableClient[];
  coaches: AssignableCoach[];
  isAssigning: boolean;
  isRetrying: boolean;
  onAssign: (target: AssignTarget) => void;
  /** Re-queues the dead job (shown only when the latest job is dead) */
  onRetry: (jobId: string) => void;
  onOpenClient: (clientId: string) => void;
  onOpenCoach: (coachId: string) => void;
  onOpenOutboxItem: (service: 'slack' | 'drive', itemId: string) => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => {
  const colors = useAppColors();
  return (
    <HStack justify='space-between' align='flex-start' spacing={4}>
      <Text fontSize='sm' color={colors.textSecondary} flexShrink={0}>
        {label}
      </Text>
      <Box fontSize='sm' color={colors.textPrimary} textAlign='right' minW={0}>
        {children}
      </Box>
    </HStack>
  );
};

export const CallDetailView = ({
  detail,
  clients,
  coaches,
  isAssigning,
  isRetrying,
  onAssign,
  onRetry,
  onOpenClient,
  onOpenCoach,
  onOpenOutboxItem,
}: CallDetailViewProps) => {
  const colors = useAppColors();
  const { call, summary, client, coach, job, outbox } = detail;
  const duration = formatDuration(call.duration_seconds);
  const isRetryScheduled = job?.status === 'pending' && job.attempts > 0;
  const isDead = job?.status === 'dead';

  return (
    <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) 320px' }} gap={6}>
      <GridItem>
        <Panel>
          <Tabs colorScheme='brand' isLazy>
            <TabList px={5}>
              <Tab py={3}>Summary</Tab>
              <Tab py={3}>Transcript</Tab>
            </TabList>
            <TabPanels>
              <TabPanel px={5} py={5}>
                <CallSummaryView summary={summary} status={call.status} />
              </TabPanel>
              <TabPanel px={5} py={5}>
                <TranscriptView transcript={call.transcript} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Panel>
      </GridItem>

      <GridItem>
        <VStack align='stretch' spacing={6}>
          {call.status === 'needs_review' && (
            <Panel title='Needs review' p={0}>
              <VStack align='stretch' spacing={3} p={5}>
                <Text fontSize='sm' color={colors.textPrimary}>
                  {call.review_reason ?? 'The call could not be matched to a client.'}
                </Text>
                <ReviewAssign
                  clients={clients}
                  coaches={coaches}
                  participants={call.participants}
                  isAssigning={isAssigning}
                  onAssign={onAssign}
                />
              </VStack>
            </Panel>
          )}

          <Panel title='Details'>
            <VStack align='stretch' spacing={3} p={5}>
              <Field label='Client'>
                {client ? (
                  <Link color={colors.textAccent} onClick={() => onOpenClient(client.id)}>
                    {client.name}
                  </Link>
                ) : (
                  'Unmatched'
                )}
              </Field>
              <Field label='Coach'>
                {coach ? (
                  <Link color={colors.textAccent} onClick={() => onOpenCoach(coach.id)}>
                    {coach.name}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
              <Field label='Date'>{formatDateTime(callDate(call))}</Field>
              {duration && <Field label='Duration'>{duration}</Field>}
              <Field label='Source'>{call.source}</Field>
              <Field label='Participants'>
                {call.participants.map((p) => (
                  <Text key={`${p.name}-${p.email}`}>
                    {p.name}
                    {p.email && (
                      <Text as='span' color={colors.textSecondary}>
                        {' '}
                        · {p.email}
                      </Text>
                    )}
                  </Text>
                ))}
              </Field>
            </VStack>
          </Panel>

          <Panel title='Pipeline'>
            <VStack align='stretch' spacing={3} p={5}>
              <Field label='Status'>
                <CallStatusBadge status={call.status} jobStatus={job?.status} />
              </Field>
              {job && (
                <Field label='Last job'>
                  {job.status} · attempt {job.attempts}/{job.max_attempts}
                </Field>
              )}
              <Field label='Slack'>
                {!call.slack_message_ts ? (
                  'Not posted'
                ) : outbox.slack ? (
                  <Link
                    color={colors.textAccent}
                    onClick={() => onOpenOutboxItem('slack', outbox.slack ?? '')}
                  >
                    Posted · view message
                  </Link>
                ) : (
                  `Posted (ts ${call.slack_message_ts})`
                )}
              </Field>
              <Field label='Drive'>
                {!call.drive_file_id ? (
                  'Not archived'
                ) : outbox.drive ? (
                  <Link
                    color={colors.textAccent}
                    onClick={() => onOpenOutboxItem('drive', outbox.drive ?? '')}
                  >
                    Archived · view document
                  </Link>
                ) : call.drive_url ? (
                  <Link color={colors.textAccent} href={call.drive_url} isExternal>
                    Archived · open in Google Docs
                  </Link>
                ) : (
                  'Archived'
                )}
              </Field>
              {job?.last_error && (call.status === 'failed' || isRetryScheduled) && (
                <Alert status={isRetryScheduled ? 'warning' : 'error'} borderRadius='md' fontSize='sm'>
                  <AlertIcon />
                  <AlertDescription wordBreak='break-word'>
                    {isRetryScheduled && 'Retrying: '}
                    {job.last_error}
                  </AlertDescription>
                </Alert>
              )}
              {isDead && job && (
                <Button
                  size='sm'
                  colorScheme='brand'
                  isLoading={isRetrying}
                  onClick={() => onRetry(job.id)}
                >
                  Retry
                </Button>
              )}
            </VStack>
          </Panel>
        </VStack>
      </GridItem>
    </Grid>
  );
};
