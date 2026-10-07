import {
  Box,
  HStack,
  Icon,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
`;

interface MicrophoneIndicatorProps {
  deviceName: string;
  audioLevel: number;
  isActive: boolean;
}

export const MicrophoneIndicator = ({
  deviceName,
  audioLevel,
  isActive,
}: MicrophoneIndicatorProps) => {
  const bgColor = useColorModeValue('purple.50', 'purple.900');
  const borderColor = useColorModeValue('purple.200', 'purple.700');
  const activeBorderColor = useColorModeValue('purple.400', 'purple.300');
  const textColor = useColorModeValue('purple.800', 'purple.100');
  const levelBarBg = useColorModeValue('purple.100', 'purple.800');

  const getLevelColor = (level: number): string => {
    if (level > 0.7) return 'green.400';
    if (level > 0.3) return 'blue.400';
    return 'purple.400';
  };

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius='xl'
      borderWidth='2px'
      borderColor={isActive ? activeBorderColor : borderColor}
      w='100%'
      transition='all 0.3s'
      boxShadow={isActive ? 'lg' : 'sm'}
    >
      <HStack spacing={4} justify='space-between'>
        <HStack spacing={3} flex='1'>
          <Box position='relative'>
            <Icon
              viewBox='0 0 24 24'
              boxSize={6}
              color={isActive ? 'purple.500' : 'gray.400'}
            >
              <path
                fill='currentColor'
                d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z'
              />
              <path
                fill='currentColor'
                d='M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z'
              />
            </Icon>
            {isActive && (
              <Box
                position='absolute'
                top='-2px'
                right='-2px'
                w='12px'
                h='12px'
                bg='green.400'
                borderRadius='full'
                animation={`${pulse} 2s ease-in-out infinite`}
                boxShadow='0 0 8px rgba(72, 187, 120, 0.6)'
              />
            )}
          </Box>

          <VStack align='flex-start' spacing={0}>
            <Text fontSize='sm' fontWeight='semibold' color={textColor}>
              {deviceName}
            </Text>
            <Text
              fontSize='xs'
              color={useColorModeValue('purple.600', 'purple.300')}
            >
              {isActive ? '🎤 Listening' : 'Inactive'}
            </Text>
          </VStack>
        </HStack>

        {isActive && (
          <HStack spacing={1.5} minW='120px'>
            {[...Array(10)].map((_, index) => {
              const barThreshold = index / 10;
              const isBarActive = audioLevel > barThreshold;
              const barHeight = 8 + index * 2;

              return (
                <Box
                  key={index}
                  w='6px'
                  h={`${barHeight}px`}
                  bg={isBarActive ? getLevelColor(audioLevel) : levelBarBg}
                  borderRadius='full'
                  transition='all 0.1s'
                  opacity={isBarActive ? 1 : 0.3}
                />
              );
            })}
          </HStack>
        )}
      </HStack>
    </Box>
  );
};
