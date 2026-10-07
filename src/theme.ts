import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

/**
 * Chakra theme: indigo brand scale, flat dashboard surfaces.
 * Color mode is driven by Redux (see App.tsx), not Chakra's own storage.
 */

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
  },
  fonts: {
    heading: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
    body: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        _dark: { bg: 'gray.900' },
      },
    },
  },
  components: {
    Badge: {
      baseStyle: {
        textTransform: 'none',
        fontWeight: 'medium',
        borderRadius: 'md',
        px: 2,
      },
    },
    Table: {
      variants: {
        simple: {
          th: { textTransform: 'none', letterSpacing: 'normal' },
        },
      },
    },
  },
});
