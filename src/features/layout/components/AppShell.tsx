import {
  AtSignIcon,
  CalendarIcon,
  EmailIcon,
  HamburgerIcon,
  MoonIcon,
  PhoneIcon,
  StarIcon,
  SunIcon,
  WarningTwoIcon,
} from '@chakra-ui/icons';
import {
  Badge,
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppColors } from '../../../constants/colors';
import type { DemoInfo } from '../../calls';
import { SimulateCallMenu } from './SimulateCallMenu';
import { SimulateWeekMenu } from './SimulateWeekMenu';

interface AppShellProps {
  reviewCount: number;
  demoInfo: DemoInfo | null;
  isSimulating: boolean;
  isSimulatingWeek: boolean;
  colorMode: 'light' | 'dark';
  onSimulate: (sampleId: string | null) => void;
  onSimulateWeek: (count: number | null) => void;
  onToggleColorMode: () => void;
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: ReactElement;
  badge?: number;
  soon?: boolean;
}

const SIDEBAR_WIDTH = '232px';

const NavLinks = ({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) => {
  const colors = useAppColors();

  return (
    <VStack align='stretch' spacing={1}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} onClick={onNavigate}>
          {({ isActive }) => (
            <HStack
              px={3}
              py={2}
              borderRadius='md'
              spacing={3}
              bg={isActive ? colors.bgActive : undefined}
              color={isActive ? colors.textAccent : colors.textPrimary}
              fontWeight={isActive ? 'semibold' : 'medium'}
              _hover={{ bg: isActive ? colors.bgActive : colors.bgHover }}
            >
              <Box as='span' fontSize='sm' display='flex'>
                {item.icon}
              </Box>
              <Text fontSize='sm' flex={1}>
                {item.label}
              </Text>
              {item.badge ? (
                <Badge colorScheme='orange' borderRadius='full'>
                  {item.badge}
                </Badge>
              ) : null}
              {item.soon && (
                <Text fontSize='xs' color={colors.textSecondary}>
                  soon
                </Text>
              )}
            </HStack>
          )}
        </NavLink>
      ))}
    </VStack>
  );
};

const Brand = () => {
  const colors = useAppColors();
  return (
    <HStack spacing={2} px={3} mb={6}>
      <Flex
        w={7}
        h={7}
        borderRadius='md'
        bg='brand.500'
        color='white'
        align='center'
        justify='center'
        fontWeight='bold'
        fontSize='sm'
      >
        C
      </Flex>
      <Text fontWeight='bold' color={colors.heading}>
        Coaching Calls
      </Text>
    </HStack>
  );
};

/**
 * Sidebar + top bar layout. The sidebar becomes a drawer below `lg`.
 */
export const AppShell = ({
  reviewCount,
  demoInfo,
  isSimulating,
  isSimulatingWeek,
  colorMode,
  onSimulate,
  onSimulateWeek,
  onToggleColorMode,
  children,
}: AppShellProps) => {
  const colors = useAppColors();
  const drawer = useDisclosure();

  const navItems: NavItem[] = [
    { to: '/calls', label: 'Calls', icon: <PhoneIcon /> },
    { to: '/review', label: 'Review queue', icon: <WarningTwoIcon />, badge: reviewCount },
    { to: '/clients', label: 'Clients', icon: <AtSignIcon /> },
    { to: '/coaches', label: 'Coaches', icon: <StarIcon /> },
    { to: '/reports', label: 'Reports', icon: <CalendarIcon /> },
    { to: '/outbox', label: 'Outbox', icon: <EmailIcon /> },
  ];

  return (
    <Flex minH='100vh' bg={colors.bgApp}>
      <Box
        as='nav'
        display={{ base: 'none', lg: 'block' }}
        w={SIDEBAR_WIDTH}
        flexShrink={0}
        position='sticky'
        top={0}
        h='100vh'
        px={3}
        py={5}
        bg={colors.bgSurface}
        borderRightWidth='1px'
        borderColor={colors.border}
      >
        <Brand />
        <NavLinks items={navItems} />
      </Box>

      <Drawer isOpen={drawer.isOpen} onClose={drawer.onClose} placement='left'>
        <DrawerOverlay />
        <DrawerContent maxW={SIDEBAR_WIDTH} bg={colors.bgSurface}>
          <DrawerBody px={3} py={5}>
            <Brand />
            <NavLinks items={navItems} onNavigate={drawer.onClose} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex direction='column' flex={1} minW={0}>
        <Flex
          as='header'
          h={14}
          px={{ base: 4, md: 8 }}
          align='center'
          justify='space-between'
          gap={3}
          bg={colors.bgSurface}
          borderBottomWidth='1px'
          borderColor={colors.border}
          position='sticky'
          top={0}
          zIndex='sticky'
        >
          <HStack spacing={2}>
            <IconButton
              aria-label='Open navigation'
              icon={<HamburgerIcon />}
              size='sm'
              variant='ghost'
              display={{ base: 'inline-flex', lg: 'none' }}
              onClick={drawer.onOpen}
            />
            {demoInfo && (
              <HStack spacing={2} display={{ base: 'none', sm: 'flex' }}>
                {(
                  [
                    ['Grain', demoInfo.grainMode],
                    ['Slack', demoInfo.slackMode],
                    ['Drive', demoInfo.driveMode],
                  ] as const
                ).map(([service, mode]) => (
                  <Badge key={service} variant='outline' colorScheme={mode === 'mock' ? 'yellow' : 'green'}>
                    {service}: {mode}
                  </Badge>
                ))}
              </HStack>
            )}
          </HStack>

          <HStack spacing={2}>
            {demoInfo?.grainMode === 'mock' && (
              <>
                <Box display={{ base: 'none', md: 'block' }}>
                  <SimulateWeekMenu
                    sampleCount={demoInfo.samples.length}
                    isSimulating={isSimulatingWeek}
                    onSimulateWeek={onSimulateWeek}
                  />
                </Box>
                <SimulateCallMenu
                  samples={demoInfo.samples}
                  isSimulating={isSimulating}
                  onSimulate={onSimulate}
                />
              </>
            )}
            <IconButton
              aria-label='Toggle color mode'
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              size='sm'
              variant='ghost'
              onClick={onToggleColorMode}
            />
          </HStack>
        </Flex>

        <Box as='main' flex={1} px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} maxW='1400px' w='100%' mx='auto'>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
};
