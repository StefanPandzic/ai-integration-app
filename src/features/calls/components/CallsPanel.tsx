import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  HStack,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useAppColors } from '../../../constants/colors';
import type {
  CallDetail,
  CallListItem,
  CallStatus,
  ClientOption,
  DemoInfo,
} from '../types';
import { CallSummaryView } from './CallSummaryView';

interface CallsPanelProps {
  calls: CallListItem[];
  demoInfo: DemoInfo | null;
  clients: ClientOption[];
  selectedCallId: string | null;
  selectedCall: CallDetail | null;
  isSimulating: boolean;
  error: string | null;
  onSimulate: (sampleId: string | null) => void;
  onSelectCall: (callId: string) => void;
  onAssign: (callId: string, clientId: string) => void;
}

const STATUS_SCHEME: Record<CallStatus, string> = {
  received: 'blue',
  needs_review: 'orange',
  summarized: 'purple',
  posted: 'green',
  failed: 'red',
};

interface ReviewAssignProps {
  clients: ClientOption[];
  onAssign: (clientId: string) => void;
}

const ReviewAssign = ({ clients, onAssign }: ReviewAssignProps) => {
  const [clientId, setClientId] = useState('');

  return (
    <HStack onClick={(e) => e.stopPropagation()}>
      <Select
        size='sm'
        placeholder='Assign to client…'
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.coach_name ? ` (${client.coach_name})` : ''}
          </option>
        ))}
      </Select>
      <Button
        size='sm'
        colorScheme='orange'
        isDisabled={!clientId}
        onClick={() => onAssign(clientId)}
      >
        Assign
      </Button>
    </HStack>
  );
};

/**
 * Coaching call pipeline: simulate mock Grain calls, watch them move
 * through matching → summary → Slack, and resolve the review queue
 */
export const CallsPanel = ({
  calls,
  demoInfo,
  clients,
  selectedCallId,
  selectedCall,
  isSimulating,
  error,
  onSimulate,
  onSelectCall,
  onAssign,
}: CallsPanelProps) => {
  const colors = useAppColors();
  const [sampleId, setSampleId] = useState('');

  return (
    <Box
      bg={colors.bgPrimary}
      borderRadius='2xl'
      p={6}
      w='100%'
      boxShadow='base'
      borderWidth='1px'
      borderColor={colors.borderPrimary}
    >
      <VStack align='stretch' spacing={4}>
        <HStack justify='space-between' wrap='wrap' spacing={4}>
          <HStack spacing={3}>
            <Heading size='md' color={colors.headingBlue}>
              Coaching calls
            </Heading>
            {demoInfo && (
              <>
                <Badge>Grain: {demoInfo.grainMode}</Badge>
                <Badge colorScheme={demoInfo.slackDryRun ? 'yellow' : 'green'}>
                  Slack: {demoInfo.slackDryRun ? 'dry run' : 'live'}
                </Badge>
              </>
            )}
          </HStack>

          {demoInfo?.grainMode === 'mock' && (
            <HStack>
              <Select
                size='sm'
                maxW='280px'
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
              >
                <option value=''>Random sample</option>
                {demoInfo.samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}: {sample.scenario}
                  </option>
                ))}
              </Select>
              <Button
                size='sm'
                colorScheme='blue'
                isLoading={isSimulating}
                onClick={() => onSimulate(sampleId || null)}
              >
                Simulate call
              </Button>
            </HStack>
          )}
        </HStack>

        {error && (
          <Alert status='error' borderRadius='md'>
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
          <GridItem maxH='480px' overflowY='auto'>
            <VStack align='stretch' spacing={2}>
              {calls.length === 0 && (
                <Text fontSize='sm' color={colors.textSecondary}>
                  No calls yet. Simulate one to start the pipeline.
                </Text>
              )}
              {calls.map((call) => (
                <Box
                  key={call.id}
                  p={3}
                  borderRadius='lg'
                  borderWidth='1px'
                  borderColor={
                    call.id === selectedCallId
                      ? colors.borderBlue
                      : colors.borderPrimary
                  }
                  bg={call.id === selectedCallId ? colors.bgBlue : undefined}
                  cursor='pointer'
                  onClick={() => onSelectCall(call.id)}
                >
                  <HStack justify='space-between'>
                    <Text fontWeight='semibold' noOfLines={1}>
                      {call.title ?? 'Untitled call'}
                    </Text>
                    <Badge colorScheme={STATUS_SCHEME[call.status]}>
                      {call.status.replace('_', ' ')}
                    </Badge>
                  </HStack>
                  <Text fontSize='sm' color={colors.textSecondary}>
                    {call.client_name ?? 'Unmatched'}
                    {call.coach_name ? ` · ${call.coach_name}` : ''} ·{' '}
                    {new Date(call.created_at).toLocaleTimeString()}
                    {call.job_status === 'running' && ' · processing…'}
                    {call.job_status === 'pending' &&
                      call.job_attempts !== null &&
                      call.job_attempts > 0 &&
                      ` · retrying (attempt ${call.job_attempts})`}
                  </Text>

                  {call.status === 'needs_review' && (
                    <VStack align='stretch' mt={2} spacing={2}>
                      <Text fontSize='sm' color={colors.textPrimary}>
                        {call.review_reason}
                      </Text>
                      <ReviewAssign
                        clients={clients}
                        onAssign={(clientId) => onAssign(call.id, clientId)}
                      />
                    </VStack>
                  )}

                  {call.job_error &&
                    (call.status === 'failed' || call.job_status === 'pending') && (
                      <Text fontSize='xs' color={colors.textSecondary} mt={1}>
                        {call.job_error}
                      </Text>
                    )}
                </Box>
              ))}
            </VStack>
          </GridItem>

          <GridItem maxH='480px' overflowY='auto'>
            <CallSummaryView detail={selectedCall} />
          </GridItem>
        </Grid>
      </VStack>
    </Box>
  );
};
