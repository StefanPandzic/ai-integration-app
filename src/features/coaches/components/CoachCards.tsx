import { Avatar, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { EmptyState, Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { CoachListItem } from '../types';

interface CoachCardsProps {
  coaches: CoachListItem[];
  onSelect: (coachId: string) => void;
}

export const CoachCards = ({ coaches, onSelect }: CoachCardsProps) => {
  const colors = useAppColors();

  if (coaches.length === 0) {
    return (
      <Panel>
        <EmptyState
          title='No coaches'
          description='Coaches come from the seed data (npm run db:seed in backend/).'
        />
      </Panel>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
      {coaches.map((coach) => (
        <Panel
          key={coach.id}
          p={5}
          cursor='pointer'
          transition='border-color 0.15s'
          _hover={{ borderColor: colors.borderAccent }}
          onClick={() => onSelect(coach.id)}
        >
          <HStack spacing={3} mb={4}>
            <Avatar size='sm' name={coach.name} bg='brand.500' color='white' />
            <VStack align='flex-start' spacing={0} minW={0}>
              <Text fontWeight='semibold' color={colors.heading}>
                {coach.name}
              </Text>
              <Text fontSize='sm' color={colors.textSecondary} noOfLines={1}>
                {coach.email}
              </Text>
            </VStack>
          </HStack>
          <HStack spacing={6}>
            {[
              { label: 'Clients', value: coach.client_count },
              { label: 'Calls (7d)', value: coach.calls_last_7_days },
              { label: 'Calls total', value: coach.call_count },
            ].map((stat) => (
              <VStack key={stat.label} align='flex-start' spacing={0}>
                <Text fontSize='lg' fontWeight='semibold' color={colors.heading}>
                  {stat.value}
                </Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  {stat.label}
                </Text>
              </VStack>
            ))}
          </HStack>
        </Panel>
      ))}
    </SimpleGrid>
  );
};
