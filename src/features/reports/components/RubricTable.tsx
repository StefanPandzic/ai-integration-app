import {
  Badge,
  Link,
  Progress,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import type { RatingDimension, ReportCallRef } from '../types';
import { RUBRIC_LABEL, formatDay, ratingScheme } from '../utils/format';

interface RubricTableProps {
  dimensions: RatingDimension[];
  calls: ReportCallRef[];
  onOpenCall: (callId: string) => void;
}

/** Rubric scores with the calls cited as evidence */
export const RubricTable = ({ dimensions, calls, onOpenCall }: RubricTableProps) => {
  const colors = useAppColors();
  const callById = new Map(calls.map((c) => [c.id, c]));

  return (
    <TableContainer whiteSpace='normal'>
      <Table size='sm'>
        <Thead>
          <Tr>
            <Th>Dimension</Th>
            <Th w='140px'>Score</Th>
            <Th>Evidence</Th>
          </Tr>
        </Thead>
        <Tbody>
          {dimensions.map((d) => (
            <Tr key={d.key}>
              <Td fontWeight='medium' color={colors.textPrimary} verticalAlign='top'>
                {RUBRIC_LABEL[d.key]}
              </Td>
              <Td verticalAlign='top'>
                <VStack align='stretch' spacing={1}>
                  <Badge alignSelf='flex-start' colorScheme={ratingScheme(d.score_1_5)}>
                    {d.score_1_5}/5
                  </Badge>
                  <Progress
                    value={d.score_1_5 * 20}
                    size='xs'
                    borderRadius='full'
                    colorScheme={ratingScheme(d.score_1_5)}
                  />
                </VStack>
              </Td>
              <Td verticalAlign='top'>
                <VStack align='stretch' spacing={1.5}>
                  {d.evidence.map((e) => {
                    const call = callById.get(e.call_id);
                    return (
                      <Text key={`${e.call_id}-${e.note}`} fontSize='sm' color={colors.textPrimary}>
                        <Link color={colors.textAccent} onClick={() => onOpenCall(e.call_id)}>
                          {call ? `${formatDay(call.date)} · ${call.title ?? 'Call'}` : 'Call'}
                        </Link>
                        {': '}
                        {e.note}
                      </Text>
                    );
                  })}
                </VStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
