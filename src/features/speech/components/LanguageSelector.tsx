import { Select, FormControl, useColorModeValue } from '@chakra-ui/react';
import { SUPPORTED_LANGUAGES } from '../types/recognition';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  disabled?: boolean;
}

export const LanguageSelector = ({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
}: LanguageSelectorProps) => {
  const selectBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.300', 'gray.600');

  return (
    <FormControl w='280px'>
      <Select
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        disabled={disabled}
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
          borderColor: 'purple.400',
          transform: 'translateY(-2px)',
          boxShadow: 'xl',
        }}
        _focus={{
          borderColor: 'purple.400',
          boxShadow: '0 0 0 3px rgba(159, 122, 234, 0.3)',
        }}
        _disabled={{
          opacity: 0.6,
          cursor: 'not-allowed',
        }}
        transition='all 0.3s'
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </Select>
    </FormControl>
  );
};
