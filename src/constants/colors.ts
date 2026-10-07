import { useColorModeValue } from '@chakra-ui/react';

/**
 * Centralized color constants for the application
 * Uses Chakra UI's useColorModeValue hook for light/dark theme support
 *
 * @returns Object containing all color values for the current theme
 */
export const useAppColors = () => {
  return {
    // Background colors
    bgPrimary: useColorModeValue('white', 'gray.800'),
    bgSecondary: useColorModeValue('gray.50', 'gray.900'),
    bgBlue: useColorModeValue('blue.50', 'blue.900'),
    bgAiBubble: useColorModeValue('gray.100', 'gray.700'),

    // Border colors
    borderPrimary: useColorModeValue('gray.200', 'gray.700'),
    borderBlue: useColorModeValue('blue.200', 'blue.700'),
    borderGreen: useColorModeValue('green.200', 'green.700'),

    // Text colors
    textPrimary: useColorModeValue('gray.700', 'gray.300'),
    textSecondary: useColorModeValue('gray.500', 'gray.400'),
    textBlue: useColorModeValue('blue.700', 'blue.200'),
    textBlueMuted: useColorModeValue('blue.600', 'blue.300'),
    textPurple: useColorModeValue('purple.600', 'purple.300'),

    // Heading colors
    headingBlue: useColorModeValue('blue.800', 'blue.100'),

    // Status colors
    statusActive: useColorModeValue('green.500', 'green.400'),
    statusInactive: useColorModeValue('gray.400', 'gray.600'),
  };
};
