import { Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAppColors } from '../constants/colors';
import { Panel } from './Panel';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export const StatCard = ({ label, value, hint }: StatCardProps) => {
  const colors = useAppColors();

  return (
    <Panel px={5} py={4}>
      <Text fontSize='sm' color={colors.textSecondary}>
        {label}
      </Text>
      <Text fontSize='2xl' fontWeight='semibold' color={colors.heading} noOfLines={1} wordBreak='break-all'>
        {value}
      </Text>
      {hint && (
        <Text fontSize='xs' color={colors.textSecondary}>
          {hint}
        </Text>
      )}
    </Panel>
  );
};
