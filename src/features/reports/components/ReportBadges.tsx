import { Badge, HStack, Spinner } from '@chakra-ui/react';
import type { RunState } from '../types';
import {
  RUN_STATE_LABEL,
  RUN_STATE_SCHEME,
  formatRating,
  ratingScheme,
} from '../utils/format';

export const RunStateBadge = ({ state }: { state: RunState }) => (
  <HStack spacing={1.5}>
    <Badge colorScheme={RUN_STATE_SCHEME[state]}>{RUN_STATE_LABEL[state]}</Badge>
    {state === 'running' && <Spinner size='xs' />}
  </HStack>
);

/** Rubric average, colored by band */
export const RatingBadge = ({ value }: { value: number | null | undefined }) => (
  <Badge variant='subtle' colorScheme={ratingScheme(value)} fontSize='sm'>
    {formatRating(value)}
  </Badge>
);
