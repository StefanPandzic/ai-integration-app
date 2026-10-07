import {
  Box,
  Textarea,
  Text,
  HStack,
  Button,
  useColorModeValue,
  VStack,
  Badge,
} from '@chakra-ui/react';
import { DeleteIcon, CheckIcon } from '@chakra-ui/icons';
import { ModelSelector, ModelMetadata, ImageUploader } from '../features/ai';

/**
 * TranscriptInput - General-purpose text input component
 *
 * Handles both speech recognition transcripts AND manual text editing.
 * This is a shared component used by multiple features (speech + manual input workflows).
 *
 * Features:
 * - Real-time transcript display from speech recognition
 * - Manual text editing via textarea onChange
 * - AI model selection
 * - Save/Clear actions
 */

interface TranscriptInputProps {
  finalTranscript: string;
  interimTranscript: string;
  isListening: boolean;
  isSaving?: boolean;
  onTranscriptChange: (text: string) => void;
  onSave: () => void;
  onClear: () => void;
  selectedModel: string;
  availableModels: ModelMetadata[];
  onModelChange: (modelName: string) => void;
  selectedImage?: string | null;
  onImageSelect?: (base64: string | null) => void;
  modelSupportsVision?: boolean;
}

export const TranscriptInput = ({
  finalTranscript,
  interimTranscript,
  isListening,
  isSaving = false,
  onTranscriptChange,
  onSave,
  onClear,
  selectedModel,
  availableModels,
  onModelChange,
  selectedImage = null,
  onImageSelect,
  modelSupportsVision = false,
}: TranscriptInputProps) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const interimColor = useColorModeValue('purple.400', 'purple.300');
  const labelColor = useColorModeValue('gray.700', 'gray.300');

  const displayText = finalTranscript + (isListening ? interimTranscript : '');
  const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Box
      bg={bgColor}
      borderRadius='2xl'
      p={8}
      w='100%'
      boxShadow='base'
      borderWidth='1px'
      borderColor={borderColor}
      transition='all 0.3s'
    >
      <VStack spacing={6} align='stretch'>
        <HStack justify='space-between' align='center'>
          <Text fontSize='xl' fontWeight='bold' color={labelColor}>
            Live Transcription
          </Text>
          {finalTranscript && (
            <Badge
              colorScheme='purple'
              fontSize='sm'
              px={3}
              py={1}
              borderRadius='full'
            >
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </Badge>
          )}
        </HStack>

        <Box position='relative'>
          <Textarea
            value={displayText}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder='Your transcription will appear here... Click the button above to start recording.'
            size='lg'
            bg={useColorModeValue('gray.50', 'gray.900')}
            borderColor={isListening ? 'blue.400' : borderColor}
            borderWidth='2px'
            resize='vertical'
            fontSize='lg'
            height='185px'
            lineHeight='tall'
            transition='all 0.3s'
            _focus={{
              borderColor: 'purple.400',
              boxShadow: '0 0 0 1px var(--chakra-colors-purple-400)',
            }}
            _hover={{
              borderColor: isListening ? 'blue.500' : 'gray.300',
            }}
          />
          {isListening && interimTranscript && (
            <Text
              fontSize='xs'
              color={interimColor}
              mt={2}
              fontWeight='semibold'
              display='flex'
              alignItems='center'
              gap={2}
            >
              <Box
                w='8px'
                h='8px'
                bg='purple.400'
                borderRadius='full'
                animation='pulse 2s ease-in-out infinite'
              />
              Listening and transcribing in real-time...
            </Text>
          )}
        </Box>

        <HStack spacing={4} justify='space-between' wrap='wrap'>
          <HStack spacing={3}>
            <ModelSelector
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={onModelChange}
              disabled={isListening}
            />
            {modelSupportsVision && onImageSelect && (
              <ImageUploader
                onImageSelect={onImageSelect}
                disabled={isListening || isSaving}
                selectedFilename={selectedImage ? 'image.png' : null}
              />
            )}
          </HStack>
          <HStack spacing={4}>
            <Button
              leftIcon={<DeleteIcon />}
              colorScheme='red'
              variant='outline'
              onClick={onClear}
              isDisabled={!finalTranscript.trim() && !interimTranscript}
              size='lg'
              borderRadius='xl'
              px={8}
            >
              Clear
            </Button>
            <Button
              leftIcon={<CheckIcon />}
              colorScheme='green'
              onClick={onSave}
              isDisabled={!finalTranscript.trim() || isSaving}
              isLoading={isSaving}
              loadingText='AI is responding...'
              size='lg'
              borderRadius='xl'
              px={8}
              boxShadow='lg'
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: 'xl',
              }}
              transition='all 0.2s'
            >
              Save with AI Response
            </Button>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
};
