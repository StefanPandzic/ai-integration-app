import {
  Badge,
  Box,
  Grid,
  GridItem,
  HStack,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { EmptyState, Panel, StatCard } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { CoachReportContent, ReportStatus } from '../types';
import { RUBRIC_LABEL, formatDay, formatRating, formatShare } from '../utils/format';
import { BulletList, SentimentCountsView } from './ReportParts';
import { RubricTable } from './RubricTable';

interface CoachReportViewProps {
  status: ReportStatus;
  content: CoachReportContent;
  onOpenCall: (callId: string) => void;
  onOpenClient: (clientId: string) => void;
}

export const CoachReportView = ({ status, content, onOpenCall, onOpenClient }: CoachReportViewProps) => {
  const colors = useAppColors();
  const { stats } = content;
  const callById = new Map(content.calls.map((c) => [c.id, c]));

  return (
    <VStack align='stretch' spacing={6}>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <StatCard label='Calls' value={stats.calls} hint={`${stats.clients} clients`} />
        <StatCard label='Rating' value={formatRating(stats.rubric_average)} hint='Rubric average' />
        <StatCard label='Coach talk share' value={formatShare(stats.coach_talk_share)} hint='Share of words spoken' />
        <StatCard
          label='Action items'
          value={stats.action_items.client + stats.action_items.coach + stats.action_items.other}
          hint={`${stats.action_items.client} client · ${stats.action_items.coach} coach`}
        />
      </SimpleGrid>

      <Panel px={5} py={4}>
        <HStack justify='space-between' flexWrap='wrap' gap={3}>
          <SentimentCountsView counts={stats.sentiment} />
          <Text fontSize='sm' color={colors.textSecondary}>
            {stats.overdue_action_items} deadlines carried in from earlier weeks · {stats.excluded_calls}{' '}
            calls excluded (processing, review or failed)
          </Text>
        </HStack>
      </Panel>

      {status === 'empty' ? (
        <Panel>
          <EmptyState
            title='No calls this week'
            description='No summarized calls were recorded for this coach, so no rating or client sections were generated.'
          />
        </Panel>
      ) : (
        <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={6}>
          <GridItem>
            <VStack align='stretch' spacing={6}>
              <Panel title='Pay attention to'>
                <Box p={5}>
                  <BulletList items={content.attention ?? []} />
                </Box>
              </Panel>

              <Panel title='Clients'>
                <VStack align='stretch' spacing={0} divider={<Box borderBottomWidth='1px' borderColor={colors.border} />}>
                  {(content.per_client ?? []).map((section) => (
                    <VStack key={section.client_id} align='stretch' spacing={3} p={5}>
                      <Link fontWeight='semibold' color={colors.heading} onClick={() => onOpenClient(section.client_id)}>
                        {section.client_name}
                      </Link>
                      <Box>
                        <Text fontSize='xs' textTransform='uppercase' color={colors.textSecondary}>
                          Progress
                        </Text>
                        <Text fontSize='sm' color={colors.textPrimary}>
                          {section.progress}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize='xs' textTransform='uppercase' color={colors.textSecondary}>
                          Next focus
                        </Text>
                        <Text fontSize='sm' color={colors.textPrimary}>
                          {section.next_focus}
                        </Text>
                      </Box>
                      {section.watch_outs.length > 0 && (
                        <Box>
                          <Text fontSize='xs' textTransform='uppercase' color={colors.textSecondary} mb={1}>
                            Watch-outs
                          </Text>
                          <BulletList items={section.watch_outs} />
                        </Box>
                      )}
                      <HStack spacing={2} flexWrap='wrap'>
                        {(section.key_topics ?? []).map((topic) => (
                          <Badge key={topic} variant='outline' textTransform='none'>
                            {topic}
                          </Badge>
                        ))}
                        {section.evidence_call_ids.map((id) => {
                          const call = callById.get(id);
                          return (
                            <Link key={id} fontSize='xs' color={colors.textAccent} onClick={() => onOpenCall(id)}>
                              {call ? `${formatDay(call.date)} call` : 'Call'}
                            </Link>
                          );
                        })}
                      </HStack>
                    </VStack>
                  ))}
                </VStack>
              </Panel>
            </VStack>
          </GridItem>

          <GridItem>
            <VStack align='stretch' spacing={6}>
              {content.coach_rating && (
                <Panel title='Coaching rating'>
                  <RubricTable dimensions={content.coach_rating.dimensions} calls={content.calls} onOpenCall={onOpenCall} />
                  <Text fontSize='sm' color={colors.textPrimary} p={5}>
                    {content.coach_rating.overall_comment}
                  </Text>
                </Panel>
              )}
              <Panel title='Improvements'>
                <Box p={5}>
                  <BulletList
                    items={(content.improvements ?? []).map((i) => `${RUBRIC_LABEL[i.dimension]}: ${i.suggestion}`)}
                    empty='No improvements suggested.'
                  />
                </Box>
              </Panel>
            </VStack>
          </GridItem>
        </Grid>
      )}
    </VStack>
  );
};
