import { ChevronDownIcon } from '@chakra-ui/icons';
import { Button, Menu, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';

interface SimulateWeekMenuProps {
  sampleCount: number;
  isSimulating: boolean;
  onSimulateWeek: (count: number | null) => void;
}

const VOLUME_TEST_CALLS = 50;

/** Sends mock Grain calls backdated across last week (data for weekly reports) */
export const SimulateWeekMenu = ({ sampleCount, isSimulating, onSimulateWeek }: SimulateWeekMenuProps) => {
  const colors = useAppColors();

  return (
    <Menu placement='bottom-end'>
      <MenuButton as={Button} size='sm' variant='outline' rightIcon={<ChevronDownIcon />} isLoading={isSimulating}>
        Simulate week
      </MenuButton>
      <MenuList maxW='320px' zIndex='dropdown'>
        <MenuItem onClick={() => onSimulateWeek(null)}>
          <div>
            <Text fontSize='sm' fontWeight='medium'>
              {sampleCount} calls
            </Text>
            <Text fontSize='xs' color={colors.textSecondary}>
              Each sample once, spread over last week
            </Text>
          </div>
        </MenuItem>
        <MenuItem onClick={() => onSimulateWeek(VOLUME_TEST_CALLS)}>
          <div>
            <Text fontSize='sm' fontWeight='medium'>
              {VOLUME_TEST_CALLS} calls
            </Text>
            <Text fontSize='xs' color={colors.textSecondary}>
              Volume test; slow with a local model
            </Text>
          </div>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};
