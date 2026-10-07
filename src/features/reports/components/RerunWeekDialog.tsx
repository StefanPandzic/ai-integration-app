import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useAppColors } from '../../../constants/colors';
import { formatPeriod, periodEnd } from '../utils/format';

interface RerunWeekDialogProps {
  isOpen: boolean;
  /** Week starts (Mondays) to offer, newest first */
  periods: string[];
  defaultPeriod: string | null;
  isStarting: boolean;
  onClose: () => void;
  onConfirm: (periodStart: string | undefined) => void;
}

const LAST_WEEK = '';

/** Admin action: regenerate and redeliver a week's reports */
export const RerunWeekDialog = ({
  isOpen,
  periods,
  defaultPeriod,
  isStarting,
  onClose,
  onConfirm,
}: RerunWeekDialogProps) => {
  const colors = useAppColors();
  const [period, setPeriod] = useState(defaultPeriod ?? LAST_WEEK);

  useEffect(() => {
    if (isOpen) setPeriod(defaultPeriod ?? LAST_WEEK);
  }, [isOpen, defaultPeriod]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Rerun a week</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align='stretch' spacing={4}>
            <Text fontSize='sm' color={colors.textPrimary}>
              Reports run automatically every Monday. Rerun only to backfill a week or after fixing a
              failure: every coach report and the manager report for the week are regenerated and
              sent to Slack and Drive again.
            </Text>
            <FormControl>
              <FormLabel fontSize='sm'>Week</FormLabel>
              <Select size='sm' value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value={LAST_WEEK}>Last full week</option>
                {periods.map((start) => (
                  <option key={start} value={start}>
                    {formatPeriod(start, periodEnd(start))}
                  </option>
                ))}
              </Select>
              <FormHelperText>Weeks run Monday to Sunday, Chicago time.</FormHelperText>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button size='sm' variant='ghost' onClick={onClose}>
            Cancel
          </Button>
          <Button
            size='sm'
            colorScheme='orange'
            isLoading={isStarting}
            onClick={() => onConfirm(period || undefined)}
          >
            Regenerate and resend
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
