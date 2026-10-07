import {
  Select,
  FormControl,
  HStack,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { ModelMetadata } from '../types/models';

interface ModelSelectorProps {
  selectedModel: string;
  availableModels: ModelMetadata[];
  onModelChange: (modelName: string) => void;
  disabled?: boolean;
}

export const ModelSelector = ({
  selectedModel,
  availableModels,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) => {
  const selectBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.300', 'gray.600');

  const isLoading = availableModels.length === 0;
  const currentModel = availableModels.find((m) => m.name === selectedModel);

  // Fallback to first available model if selected model isn't in the list
  const displayValue = currentModel
    ? selectedModel
    : availableModels[0]?.name || '';

  return (
    <FormControl w='280px'>
      <HStack spacing={2} align='center'>
        <Select
          value={displayValue}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled || isLoading}
          size='lg'
          bg={selectBg}
          borderColor={borderColor}
          borderWidth='2px'
          borderRadius='xl'
          fontWeight='semibold'
          fontSize='md'
          h='56px'
          boxShadow='lg'
          _hover={{
            borderColor: 'blue.400',
            transform: 'translateY(-2px)',
            boxShadow: 'xl',
          }}
          _focus={{
            borderColor: 'blue.400',
            boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.3)',
          }}
          _disabled={{
            opacity: 0.6,
            cursor: 'not-allowed',
          }}
          transition='all 0.3s'
          flex={1}
        >
          {isLoading ? (
            <option value='' disabled>
              Loading models...
            </option>
          ) : (
            availableModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))
          )}
        </Select>
        {currentModel && (
          <Badge
            colorScheme={currentModel.type === 'cloud' ? 'blue' : 'green'}
            fontSize='xs'
            px={2}
            py={1}
            borderRadius='md'
            fontWeight='bold'
            textTransform='uppercase'
          >
            {currentModel.type}
          </Badge>
        )}
      </HStack>
    </FormControl>
  );
};
