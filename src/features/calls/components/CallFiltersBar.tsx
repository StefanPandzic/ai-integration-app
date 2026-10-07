import { Button, HStack, Select } from '@chakra-ui/react';
import type { CallFilters, CallStatus } from '../types';
import { STATUS_LABEL } from '../utils/format';

interface FilterOption {
  id: string;
  name: string;
}

interface CallFiltersBarProps {
  filters: CallFilters;
  coaches: FilterOption[];
  clients: FilterOption[];
  onChange: (filters: CallFilters) => void;
}

const STATUSES = Object.keys(STATUS_LABEL) as CallStatus[];

export const CallFiltersBar = ({
  filters,
  coaches,
  clients,
  onChange,
}: CallFiltersBarProps) => {
  const hasFilters = Boolean(filters.status || filters.coachId || filters.clientId);

  return (
    <HStack spacing={2} flexWrap='wrap' rowGap={2}>
      <Select
        size='sm'
        w='170px'
        borderRadius='md'
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({
            ...filters,
            status: STATUSES.find((s) => s === e.target.value),
          })
        }
      >
        <option value=''>All statuses</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </Select>

      <Select
        size='sm'
        w='170px'
        borderRadius='md'
        value={filters.coachId ?? ''}
        onChange={(e) => onChange({ ...filters, coachId: e.target.value || undefined })}
      >
        <option value=''>All coaches</option>
        {coaches.map((coach) => (
          <option key={coach.id} value={coach.id}>
            {coach.name}
          </option>
        ))}
      </Select>

      <Select
        size='sm'
        w='170px'
        borderRadius='md'
        value={filters.clientId ?? ''}
        onChange={(e) => onChange({ ...filters, clientId: e.target.value || undefined })}
      >
        <option value=''>All clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </Select>

      {hasFilters && (
        <Button size='sm' variant='ghost' onClick={() => onChange({})}>
          Clear
        </Button>
      )}
    </HStack>
  );
};
