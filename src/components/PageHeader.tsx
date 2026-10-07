import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAppColors } from '../constants/colors';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Small line above the title, e.g. a back link */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  actions,
}: PageHeaderProps) => {
  const colors = useAppColors();

  return (
    <Flex
      justify='space-between'
      align={{ base: 'flex-start', md: 'flex-end' }}
      direction={{ base: 'column', md: 'row' }}
      gap={4}
      mb={6}
    >
      <Box minW={0}>
        {eyebrow && <Box mb={1}>{eyebrow}</Box>}
        <Heading size='lg' color={colors.heading} noOfLines={2}>
          {title}
        </Heading>
        {subtitle && (
          <Text mt={1} color={colors.textSecondary}>
            {subtitle}
          </Text>
        )}
      </Box>
      {actions}
    </Flex>
  );
};
