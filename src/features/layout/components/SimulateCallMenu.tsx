import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Button,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItemOption,
  MenuItem,
  MenuList,
  MenuOptionGroup,
  Text,
} from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import type { DemoSwitch, SampleCall } from '../../calls';

interface SimulateCallMenuProps {
  samples: SampleCall[];
  isSimulating: boolean;
  dropNextWebhook: boolean;
  failNextCall: boolean;
  onSimulate: (sampleId: string | null) => void;
  onToggleSwitch: (name: DemoSwitch, enabled: boolean) => void;
}

const SWITCHES: { name: DemoSwitch; label: string; hint: string }[] = [
  {
    name: 'drop-next-webhook',
    label: 'Drop next webhook',
    hint: 'The call reaches Grain but not us; Reconcile recovers it',
  },
  {
    name: 'fail-next-call',
    label: 'Fail next call',
    hint: 'The next call dies once: alert, then Retry',
  },
];

/** Sends a mock Grain sample through the webhook path; demo failure switches */
export const SimulateCallMenu = ({
  samples,
  isSimulating,
  dropNextWebhook,
  failNextCall,
  onSimulate,
  onToggleSwitch,
}: SimulateCallMenuProps) => {
  const colors = useAppColors();
  const armed = SWITCHES.filter(
    (s) => (s.name === 'drop-next-webhook' ? dropNextWebhook : failNextCall),
  ).map((s) => s.name);

  return (
    <Menu placement='bottom-end' closeOnSelect={false}>
      <MenuButton
        as={Button}
        size='sm'
        colorScheme='brand'
        rightIcon={<ChevronDownIcon />}
        isLoading={isSimulating}
      >
        Simulate call
      </MenuButton>
      <MenuList maxW='360px' maxH='70vh' overflowY='auto' zIndex='dropdown'>
        <MenuItem onClick={() => onSimulate(null)} fontWeight='medium' closeOnSelect>
          Random sample
        </MenuItem>
        <MenuDivider />
        {samples.map((sample) => (
          <MenuItem key={sample.id} onClick={() => onSimulate(sample.id)} closeOnSelect>
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
        <MenuDivider />
        <MenuGroup title='Failure demo'>
          <MenuOptionGroup type='checkbox' value={armed}>
            {SWITCHES.map((s) => (
              <MenuItemOption
                key={s.name}
                value={s.name}
                onClick={() => onToggleSwitch(s.name, !armed.includes(s.name))}
              >
                <Text fontSize='sm' fontWeight='medium'>
                  {s.label}
                </Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  {s.hint}
                </Text>
              </MenuItemOption>
            ))}
          </MenuOptionGroup>
        </MenuGroup>
      </MenuList>
    </Menu>
  );
};
