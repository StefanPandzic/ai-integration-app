import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Button,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import type { SampleCall } from '../../calls';

interface SimulateCallMenuProps {
  samples: SampleCall[];
  isSimulating: boolean;
  onSimulate: (sampleId: string | null) => void;
}

/** Sends a mock Grain sample through the webhook path */
export const SimulateCallMenu = ({
  samples,
  isSimulating,
  onSimulate,
}: SimulateCallMenuProps) => {
  const colors = useAppColors();

  return (
    <Menu placement='bottom-end'>
      <MenuButton
        as={Button}
        size='sm'
        colorScheme='brand'
        rightIcon={<ChevronDownIcon />}
        isLoading={isSimulating}
      >
        Simulate call
      </MenuButton>
      <MenuList maxW='360px' zIndex='dropdown'>
        <MenuItem onClick={() => onSimulate(null)} fontWeight='medium'>
          Random sample
        </MenuItem>
        <MenuDivider />
        {samples.map((sample) => (
          <MenuItem key={sample.id} onClick={() => onSimulate(sample.id)}>
            <div>
              <Text fontSize='sm' fontWeight='medium'>
                {sample.title}
              </Text>
              <Text fontSize='xs' color={colors.textSecondary}>
                {sample.scenario}
              </Text>
            </div>
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
};
