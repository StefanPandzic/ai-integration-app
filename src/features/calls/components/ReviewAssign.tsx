import { Button, HStack, Select } from '@chakra-ui/react';
import { useState } from 'react';
import type { AssignableClient } from '../types';

interface ReviewAssignProps {
  clients: AssignableClient[];
  isAssigning: boolean;
  onAssign: (clientId: string) => void;
}

/** Client picker that resolves a review-queue call */
export const ReviewAssign = ({ clients, isAssigning, onAssign }: ReviewAssignProps) => {
  const [clientId, setClientId] = useState('');

  return (
    <HStack spacing={2} w='100%'>
      <Select
        size='sm'
        borderRadius='md'
        placeholder='Assign to client…'
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.coach_name ? ` (${client.coach_name})` : ''}
          </option>
        ))}
      </Select>
      <Button
        size='sm'
        colorScheme='brand'
        flexShrink={0}
        isDisabled={!clientId}
        isLoading={isAssigning}
        onClick={() => onAssign(clientId)}
      >
        Assign
      </Button>
    </HStack>
  );
};
