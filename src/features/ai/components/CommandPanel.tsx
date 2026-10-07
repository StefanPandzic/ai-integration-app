import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  CloseButton,
  Icon,
  Progress,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { BatchCommandResult, ProcessingStep } from '../types';
import { useAppColors } from '../../../constants/colors';

interface CommandPanelProps {
  isProcessing: boolean;
  currentResult: BatchCommandResult | null;
  history: BatchCommandResult[];
  error: string | null;
  onDismiss: () => void;
  processingSteps?: ProcessingStep[];
}

export const CommandPanel = ({
  isProcessing,
  currentResult,
  history,
  error,
  onDismiss,
  processingSteps = [],
}: CommandPanelProps) => {
  // Get all color constants using the centralized hook
  const colors = useAppColors();

  return (
    <Box
      bg={colors.bgPrimary}
      borderWidth='1px'
      borderColor={colors.borderPrimary}
      borderRadius='2xl'
      p={6}
      boxShadow='xl'
      w='100%'
      transition='all 0.3s'
    >
      <HStack justify='space-between' align='center' mb={4}>
        <HStack spacing={2}>
          <Icon viewBox='0 0 24 24' boxSize={6} color='purple.500'>
            <path
              fill='currentColor'
              d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
            />
          </Icon>
          <Text fontSize='lg' fontWeight='bold' color={colors.textPrimary}>
            Commands
          </Text>
        </HStack>
        {isProcessing && (
          <Badge
            colorScheme='blue'
            px={3}
            py={1}
            borderRadius='full'
            fontSize='xs'
          >
            Processing
          </Badge>
        )}
      </HStack>

      {processingSteps.length > 0 && (
        <Box
          bg={colors.bgSecondary}
          borderRadius='xl'
          borderWidth='1px'
          borderColor={colors.borderPrimary}
          p={4}
          mb={3}
        >
          <HStack justify='space-between' mb={3}>
            <Text fontSize='xs' fontWeight='bold' color='purple.600'>
              PIPELINE DETAILS
            </Text>
            {!isProcessing &&
              processingSteps.every((s) => s.status === 'complete') && (
                <Badge colorScheme='green' fontSize='xs' px={2} py={1}>
                  Completed
                </Badge>
              )}
          </HStack>
          <VStack spacing={3} align='stretch'>
            {processingSteps.map((step) => (
              <HStack key={step.id} spacing={3} align='start'>
                <Box flexShrink={0} mt={0.5}>
                  {step.status === 'complete' && (
                    <CheckCircleIcon color='green.500' boxSize={4} />
                  )}
                  {step.status === 'active' && (
                    <Spinner size='sm' color='blue.500' thickness='2px' />
                  )}
                  {step.status === 'pending' && (
                    <Box
                      w={4}
                      h={4}
                      borderRadius='full'
                      bg='gray.300'
                      opacity={0.5}
                    />
                  )}
                  {step.status === 'error' && (
                    <WarningIcon color='red.500' boxSize={4} />
                  )}
                </Box>
                <VStack align='start' spacing={0.5} flex='1'>
                  <Text
                    fontSize='sm'
                    fontWeight={step.status === 'active' ? 'bold' : 'semibold'}
                    color={
                      step.status === 'complete'
                        ? 'green.600'
                        : step.status === 'active'
                          ? colors.textBlue
                          : step.status === 'error'
                            ? 'red.600'
                            : colors.textPrimary
                    }
                  >
                    {step.label}
                  </Text>
                  {step.details && (
                    <Text
                      fontSize='xs'
                      color={
                        step.status === 'active'
                          ? 'blue.600'
                          : step.status === 'complete'
                            ? 'green.600'
                            : 'gray.500'
                      }
                      fontWeight={
                        step.status === 'active' ? 'medium' : 'normal'
                      }
                    >
                      {step.details}
                    </Text>
                  )}
                </VStack>
              </HStack>
            ))}
          </VStack>

          {/* Progress bar */}
          <Box mt={4}>
            <HStack justify='space-between' mb={1}>
              <Text fontSize='xs' fontWeight='semibold' color='gray.600'>
                Progress
              </Text>
              <Text fontSize='xs' fontWeight='bold' color='blue.600'>
                {Math.round(
                  (processingSteps.filter((s) => s.status === 'complete')
                    .length /
                    processingSteps.length) *
                    100,
                )}
                %
              </Text>
            </HStack>
            <Progress
              value={
                (processingSteps.filter((s) => s.status === 'complete').length /
                  processingSteps.length) *
                100
              }
              size='sm'
              colorScheme='blue'
              borderRadius='full'
              hasStripe
              isAnimated={processingSteps.some((s) => s.status === 'active')}
            />
          </Box>
        </Box>
      )}

      {error && !currentResult && (
        <Alert status='error' mb={3} borderRadius='xl' variant='left-accent'>
          <AlertIcon />
          <AlertDescription flex='1' fontSize='sm'>
            {error}
          </AlertDescription>
          <CloseButton onClick={onDismiss} />
        </Alert>
      )}

      {currentResult && (
        <Alert
          status={currentResult.success ? 'success' : 'warning'}
          mb={3}
          borderRadius='xl'
          variant='left-accent'
          boxShadow='md'
        >
          <AlertIcon />
          <Box flex='1'>
            <HStack spacing={2} mb={1}>
              {currentResult.success ? (
                <CheckCircleIcon color='green.500' />
              ) : (
                <WarningIcon color='orange.500' />
              )}
              <Text fontWeight='bold' fontSize='sm'>
                {currentResult.message}
              </Text>
            </HStack>
            {currentResult.command && (
              <>
                <Text fontSize='xs' mt={1} opacity={0.8}>
                  {currentResult.command.interpretation}
                </Text>
                {currentResult.command.commands.length > 1 && (
                  <Badge colorScheme='purple' mt={2} fontSize='xs'>
                    {currentResult.command.commands.length} commands executed
                  </Badge>
                )}
              </>
            )}
          </Box>
          <CloseButton onClick={onDismiss} />
        </Alert>
      )}

      {!isProcessing && !currentResult && !error && history.length === 0 && (
        <Box textAlign='center' py={8}>
          <Text fontSize='sm' color='gray.500'>
            Command pipeline ready. Start speaking to see AI processing steps.
          </Text>
        </Box>
      )}
    </Box>
  );
};
