import { Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAppColors } from '../constants/colors';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  const colors = useAppColors();

  return (
    <VStack spacing={2} py={10} px={6} textAlign='center'>
      <Text fontWeight='medium' color={colors.textPrimary}>
        {title}
      </Text>
      {description && (
        <Text fontSize='sm' color={colors.textSecondary} maxW='md'>
          {description}
        </Text>
      )}
      {action}
    </VStack>
  );
};
