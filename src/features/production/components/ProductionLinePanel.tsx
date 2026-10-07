import {
  Box,
  Grid,
  VStack,
  HStack,
  Text,
  Switch,
  Icon,
} from '@chakra-ui/react';
import { ProductionLineState, PrinterState } from '../types';
import { useAppColors } from '../../../constants/colors';

interface ProductionLinePanelProps {
  lines: ProductionLineState[];
  printers: PrinterState[];
  onToggleLine: (lineId: number) => void;
  onTogglePrinter: (lineId: number) => void;
}

/**
 * Visual control panel for production line devices
 * Displays 3 production lines in vertical columns, each with:
 * - Line switch (on/off control for production line)
 * - Barcode printer switch (on/off control for printing)
 *
 * Features:
 * - Responsive grid layout: 3 columns on desktop, 1 column on mobile
 * - Color-coded status: green (active), gray (inactive)
 * - Manual toggle controls with visual feedback
 * - Theme-aware colors (light/dark mode support)
 *
 * Architecture:
 * - Pure presentational component (no internal state)
 * - All state managed via props from parent (App.tsx)
 * - Callbacks trigger actions in parent via useProductionLine hook
 *
 * Voice Control:
 * - Integrated via CommandExecutor in parent
 * - Commands: "turn on line 1", "disable printer 2", etc.
 *
 * @param lines - Array of production line states (3 items)
 * @param printers - Array of printer states (3 items)
 * @param onToggleLine - Callback to toggle line switch
 * @param onTogglePrinter - Callback to toggle printer switch
 */
export const ProductionLinePanel = ({
  lines,
  printers,
  onToggleLine,
  onTogglePrinter,
}: ProductionLinePanelProps) => {
  const colors = useAppColors();
  const getStatusColor = (isActive: boolean) =>
    isActive ? colors.statusActive : colors.statusInactive;
  const getStatusText = (isActive: boolean) => (isActive ? 'ON' : 'OFF');

  return (
    <Box
      p={4}
      bg={colors.bgBlue}
      borderRadius='xl'
      borderWidth='2px'
      borderColor={colors.borderBlue}
      w='100%'
      boxShadow='sm'
    >
      <HStack mb={4} spacing={2}>
        <Icon viewBox='0 0 24 24' boxSize={6} color={colors.headingBlue}>
          <path
            fill='currentColor'
            d='M22 21V8L18 12V3h-2v9l-4 4V8l-4 4V3H6v18H2v2h20v-2h-2M8 5h2v14H8V5m8 0h2v14h-2V5z'
          />
        </Icon>
        <Text fontSize='lg' fontWeight='bold' color={colors.headingBlue}>
          Production Lines
        </Text>
      </HStack>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        {lines.map((line) => {
          // Find corresponding printer for this line
          const printer = printers.find((p) => p.lineId === line.id);

          return (
            <VStack
              key={line.id}
              spacing={3}
              p={3}
              bg={colors.bgPrimary}
              borderRadius='lg'
              borderWidth='1px'
              borderColor={colors.borderPrimary}
              align='stretch'
            >
              {/* Line Header */}
              <Text
                fontSize='md'
                fontWeight='semibold'
                color={colors.headingBlue}
                textAlign='center'
              >
                Line {line.id}
              </Text>

              {/* Production Line Switch */}
              <VStack spacing={2} align='stretch'>
                <HStack justify='space-between'>
                  <HStack spacing={2}>
                    {/* Line switch icon */}
                    <Icon
                      viewBox='0 0 24 24'
                      boxSize={5}
                      color={getStatusColor(line.isActive)}
                    >
                      <path
                        fill='currentColor'
                        d='M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M17,15A3,3 0 0,1 14,12A3,3 0 0,1 17,9A3,3 0 0,1 20,12A3,3 0 0,1 17,15Z'
                      />
                    </Icon>
                    <Text fontSize='sm' color={colors.textPrimary}>
                      Line Switch
                    </Text>
                  </HStack>
                  <Switch
                    isChecked={line.isActive}
                    onChange={() => onToggleLine(line.id)}
                    colorScheme='green'
                    size='md'
                  />
                </HStack>
                <Text
                  fontSize='xs'
                  color={getStatusColor(line.isActive)}
                  fontWeight='bold'
                  textAlign='right'
                >
                  {getStatusText(line.isActive)}
                </Text>
              </VStack>

              {/* Barcode Printer Switch */}
              <VStack spacing={2} align='stretch'>
                <HStack justify='space-between'>
                  <HStack spacing={2}>
                    {/* Printer icon */}
                    <Icon
                      viewBox='0 0 24 24'
                      boxSize={5}
                      color={getStatusColor(printer?.isActive || false)}
                    >
                      <path
                        fill='currentColor'
                        d='M18,3H6V7H18M19,12A1,1 0 0,1 18,11A1,1 0 0,1 19,10A1,1 0 0,1 20,11A1,1 0 0,1 19,12M16,19H8V14H16M19,8H5A3,3 0 0,0 2,11V17H6V21H18V17H22V11A3,3 0 0,0 19,8Z'
                      />
                    </Icon>
                    <Text fontSize='sm' color={colors.textPrimary}>
                      Printer
                    </Text>
                  </HStack>
                  <Switch
                    isChecked={printer?.isActive || false}
                    onChange={() => onTogglePrinter(line.id)}
                    colorScheme='green'
                    size='md'
                  />
                </HStack>
                <Text
                  fontSize='xs'
                  color={getStatusColor(printer?.isActive || false)}
                  fontWeight='bold'
                  textAlign='right'
                >
                  {getStatusText(printer?.isActive || false)}
                </Text>
              </VStack>
            </VStack>
          );
        })}
      </Grid>
    </Box>
  );
};
