import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { useAppColors } from '../../../constants/colors';

interface ThinkingPanelProps {
  thinking: string | null;
  isActive: boolean;
}

export const ThinkingPanel = ({ thinking, isActive }: ThinkingPanelProps) => {
  const colors = useAppColors();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when thinking updates
  useEffect(() => {
    if (scrollRef.current && thinking) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking]);

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
      <Accordion allowToggle defaultIndex={[0]}>
        <AccordionItem border='none'>
          <AccordionButton
            _hover={{ bg: colors.bgSecondary }}
            borderRadius='xl'
            px={4}
            py={3}
          >
            <HStack flex='1' spacing={3}>
              <Icon viewBox='0 0 24 24' boxSize={6} color='purple.500'>
                <path
                  fill='currentColor'
                  d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z'
                />
              </Icon>
              <VStack align='start' spacing={0} flex='1'>
                <Text
                  fontSize='lg'
                  fontWeight='bold'
                  color={colors.textPrimary}
                >
                  🧠 AI Reasoning
                </Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  {isActive
                    ? 'Thinking in progress...'
                    : thinking
                      ? 'Reasoning complete'
                      : 'No reasoning available'}
                </Text>
              </VStack>
              {isActive && (
                <Badge
                  colorScheme='purple'
                  px={3}
                  py={1}
                  borderRadius='full'
                  fontSize='xs'
                >
                  Active
                </Badge>
              )}
            </HStack>
            <AccordionIcon ml={2} />
          </AccordionButton>

          <AccordionPanel pb={4} pt={4}>
            {isActive && !thinking && (
              <HStack
                spacing={3}
                p={4}
                bg={colors.bgSecondary}
                borderRadius='xl'
                borderWidth='1px'
                borderColor={colors.borderPrimary}
              >
                <Spinner size='md' color='purple.500' thickness='3px' />
                <Text fontSize='sm' color={colors.textSecondary}>
                  AI is analyzing your input...
                </Text>
              </HStack>
            )}

            {thinking && (
              <Box
                ref={scrollRef}
                bg={colors.bgSecondary}
                borderRadius='xl'
                p={4}
                maxH='300px'
                overflowY='auto'
                borderWidth='1px'
                borderColor={colors.borderPrimary}
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    bg: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bg: colors.borderPrimary,
                  },
                }}
              >
                <Text
                  fontSize='sm'
                  color={colors.textPrimary}
                  fontFamily='mono'
                  whiteSpace='pre-wrap'
                  lineHeight='tall'
                >
                  {thinking}
                </Text>
              </Box>
            )}

            {!thinking && !isActive && (
              <Box
                p={4}
                bg={colors.bgSecondary}
                borderRadius='xl'
                borderWidth='1px'
                borderColor={colors.borderPrimary}
                textAlign='center'
              >
                <Text fontSize='sm' color={colors.textSecondary}>
                  No reasoning available. AI reasoning will appear here during
                  processing.
                </Text>
              </Box>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  );
};
