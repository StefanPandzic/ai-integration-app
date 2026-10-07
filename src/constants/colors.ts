import { useColorModeValue } from '@chakra-ui/react';

/**
 * Centralized color constants for the application
 * Uses Chakra UI's useColorModeValue hook for light/dark theme support
 * (`brand` is defined in src/theme.ts)
 *
 * @returns Object containing all color values for the current theme
 */
export const useAppColors = () => {
  return {
    // Backgrounds
    bgApp: useColorModeValue('gray.50', 'gray.900'),
    bgSurface: useColorModeValue('white', 'gray.800'),
    bgSubtle: useColorModeValue('gray.50', 'whiteAlpha.50'),
    bgHover: useColorModeValue('gray.50', 'whiteAlpha.100'),
    bgActive: useColorModeValue('brand.50', 'whiteAlpha.200'),

    // Borders
    border: useColorModeValue('gray.200', 'gray.700'),
    borderAccent: useColorModeValue('brand.300', 'brand.400'),

    // Text
    heading: useColorModeValue('gray.900', 'gray.50'),
    textPrimary: useColorModeValue('gray.700', 'gray.200'),
    textSecondary: useColorModeValue('gray.500', 'gray.400'),
    textAccent: useColorModeValue('brand.600', 'brand.300'),

    // Quotes and callouts
    quoteBorder: useColorModeValue('brand.200', 'brand.700'),
  };
};
