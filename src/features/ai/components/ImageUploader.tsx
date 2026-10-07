import { useRef, useState } from 'react';
import {
  Button,
  HStack,
  Text,
  IconButton,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { AttachmentIcon, CloseIcon } from '@chakra-ui/icons';

interface ImageUploaderProps {
  onImageSelect: (base64: string | null) => void;
  disabled?: boolean;
  selectedFilename?: string | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const ImageUploader = ({
  onImageSelect,
  disabled = false,
  selectedFilename = null,
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(selectedFilename);
  const toast = useToast();

  const textColor = useColorModeValue('gray.700', 'gray.300');
  const buttonBg = useColorModeValue('purple.500', 'purple.600');
  const buttonHoverBg = useColorModeValue('purple.600', 'purple.700');

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PNG, JPG, or WEBP image.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Image must be smaller than 5MB.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Convert to base64
    try {
      const base64 = await fileToBase64(file);
      setFilename(file.name);
      onImageSelect(base64);
    } catch (error) {
      toast({
        title: 'Error reading file',
        description: 'Failed to process the image. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      console.error('File read error:', error);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 data without the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleClear = () => {
    setFilename(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <HStack spacing={2}>
      <input
        ref={fileInputRef}
        type='file'
        accept='.png,.jpg,.jpeg,.webp'
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!filename ? (
        <Button
          leftIcon={<AttachmentIcon />}
          onClick={handleButtonClick}
          isDisabled={disabled}
          bg={buttonBg}
          color='white'
          _hover={{ bg: buttonHoverBg }}
          size='sm'
        >
          Attach Image
        </Button>
      ) : (
        <HStack
          spacing={2}
          px={3}
          py={1}
          borderRadius='md'
          bg={useColorModeValue('gray.100', 'gray.700')}
        >
          <AttachmentIcon color={textColor} />
          <Text fontSize='sm' color={textColor} maxW='150px' isTruncated>
            {filename}
          </Text>
          <IconButton
            aria-label='Remove image'
            icon={<CloseIcon />}
            size='xs'
            variant='ghost'
            onClick={handleClear}
            isDisabled={disabled}
          />
        </HStack>
      )}
    </HStack>
  );
};
