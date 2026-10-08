import { Button, HStack, Input, Select, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import type { AssignableClient, AssignableCoach, AssignTarget, Participant } from '../types';

interface ReviewAssignProps {
  clients: AssignableClient[];
  coaches: AssignableCoach[];
  /** Call participants; prefill the new-client form */
  participants: Participant[];
  isAssigning: boolean;
  onAssign: (target: AssignTarget) => void;
}

const NEW_CLIENT = 'new';

const sameEmail = (a: string | null, b: string | null): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Suggested new client: the first participant who is neither a coach nor
 * a known client; coach: the coach on the call, else the first coach
 */
const suggestNewClient = (
  participants: Participant[],
  clients: AssignableClient[],
  coaches: AssignableCoach[],
) => {
  const isCoach = (p: Participant) => coaches.some((c) => sameEmail(c.email, p.email));
  const isClient = (p: Participant) => clients.some((c) => sameEmail(c.email, p.email));
  const guest = participants.find((p) => !isCoach(p) && !isClient(p));
  const coachOnCall = coaches.find((c) => participants.some((p) => sameEmail(c.email, p.email)));
  return {
    name: guest?.name ?? '',
    email: guest?.email ?? '',
    coachId: (coachOnCall ?? coaches[0])?.id ?? '',
  };
};

/** Client picker that resolves a review-queue call, or adds a new client */
export const ReviewAssign = ({
  clients,
  coaches,
  participants,
  isAssigning,
  onAssign,
}: ReviewAssignProps) => {
  const [clientId, setClientId] = useState('');
  const [draft, setDraft] = useState({ name: '', email: '', coachId: '' });
  const isNew = clientId === NEW_CLIENT;

  const selectClient = (value: string) => {
    setClientId(value);
    if (value === NEW_CLIENT) setDraft(suggestNewClient(participants, clients, coaches));
  };

  const canAssign = isNew ? !!draft.name.trim() && !!draft.coachId : !!clientId;

  const assign = () =>
    onAssign(
      isNew
        ? {
            newClient: {
              name: draft.name.trim(),
              email: draft.email.trim() || null,
              coachId: draft.coachId,
            },
          }
        : { clientId },
    );

  return (
    <VStack align='stretch' spacing={2} w='100%'>
      <HStack spacing={2}>
        <Select
          size='sm'
          borderRadius='md'
          placeholder='Assign to client…'
          value={clientId}
          onChange={(e) => selectClient(e.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.coach_name ? ` (${client.coach_name})` : ''}
            </option>
          ))}
          <option value={NEW_CLIENT}>+ New client…</option>
        </Select>
        <Button
          size='sm'
          colorScheme='brand'
          flexShrink={0}
          isDisabled={!canAssign}
          isLoading={isAssigning}
          onClick={assign}
        >
          {isNew ? 'Add & assign' : 'Assign'}
        </Button>
      </HStack>

      {isNew && (
        <>
          <Input
            size='sm'
            borderRadius='md'
            placeholder='Client name'
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            size='sm'
            borderRadius='md'
            type='email'
            placeholder='Email (matches their future calls)'
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <Select
            size='sm'
            borderRadius='md'
            placeholder='Coach…'
            value={draft.coachId}
            onChange={(e) => setDraft({ ...draft, coachId: e.target.value })}
          >
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </Select>
        </>
      )}
    </VStack>
  );
};
