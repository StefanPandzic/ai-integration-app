import { Button, Box, useColorModeValue } from '@chakra-ui/react';
import { PhoneIcon } from '@chakra-ui/icons';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
`;

interface SpeechRecognitionButtonProps {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled = false,
}: SpeechRecognitionButtonProps) => {
  return (
    <Box position='relative' w='280px'>
      <Button
        size='lg'
        w='100%'
        h='56px'
        colorScheme={isListening ? 'red' : 'purple'}
        onClick={isListening ? onStop : onStart}
        disabled={disabled}
        leftIcon={
          <PhoneIcon
            boxSize={5}
            transform={isListening ? 'rotate(135deg)' : 'none'}
            transition='all 0.3s'
          />
        }
        borderRadius='xl'
        fontWeight='semibold'
        fontSize='md'
        animation={isListening ? `${pulse} 2s ease-in-out infinite` : undefined}
        boxShadow='lg'
        _hover={{
          transform: 'translateY(-2px)',
          boxShadow: 'xl',
        }}
        _active={{
          transform: 'translateY(0)',
        }}
        transition='all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      >
        {isListening ? 'Stop Recording' : 'Start Recording'}
      </Button>

      {isListening && (
        <Box
          position='absolute'
          top='-8px'
          right='-8px'
          w='24px'
          h='24px'
          bg='red.500'
          borderRadius='full'
          border='3px solid'
          borderColor={useColorModeValue('white', 'gray.800')}
          animation={`${pulse} 2s ease-in-out infinite`}
          boxShadow='0 0 10px rgba(239, 68, 68, 0.6)'
        >
          <Box
            position='absolute'
            top='50%'
            left='50%'
            transform='translate(-50%, -50%)'
            w='8px'
            h='8px'
            bg='white'
            borderRadius='full'
          />
        </Box>
      )}
    </Box>
  );
};
