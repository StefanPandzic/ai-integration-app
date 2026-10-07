import { Box, Button, Flex, HStack, Text, Tooltip, VStack } from '@chakra-ui/react';
import { EmptyState, Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { CoachReportSummary, CoachReportTrendPoint } from '../types';
import { formatDay, formatPeriod, formatRating, ratingScheme } from '../utils/format';
import { RatingBadge } from './ReportBadges';

interface CoachReportPanelProps {
  latest: CoachReportSummary | null;
  trend: CoachReportTrendPoint[];
  onOpenReport: (reportId: string) => void;
}

const BAR_MAX_HEIGHT = 72;

/** Coach profile: latest weekly report and the rubric average over recent weeks */
export const CoachReportPanel = ({ latest, trend, onOpenReport }: CoachReportPanelProps) => {
  const colors = useAppColors();

  return (
    <Panel
      title='Weekly report'
      actions={
        latest && (
          <Button size='sm' variant='ghost' onClick={() => onOpenReport(latest.id)}>
            Open latest
          </Button>
        )
      }
    >
      {!latest ? (
        <EmptyState
          title='No reports yet'
          description='Weekly coach reports (client progress, coaching rating and improvements) are generated from call summaries every Monday.'
        />
      ) : (
        <VStack align='stretch' spacing={5} p={5}>
          <HStack justify='space-between'>
            <Box>
              <Text fontSize='sm' color={colors.textSecondary}>
                {formatPeriod(latest.period_start, latest.period_end)}
              </Text>
              <Text fontSize='sm' color={colors.textPrimary}>
                {latest.status === 'empty' ? 'No calls that week' : 'Rubric average'}
              </Text>
            </Box>
            {latest.status === 'ready' && <RatingBadge value={latest.rubric_average} />}
          </HStack>

          <Box>
            <Text fontSize='xs' textTransform='uppercase' letterSpacing='wide' color={colors.textSecondary} mb={2}>
              Rating trend
            </Text>
            <Flex align='flex-end' gap={2} h={`${BAR_MAX_HEIGHT + 20}px`}>
              {trend.map((point) => (
                <Tooltip
                  key={point.id}
                  label={`${formatDay(point.period_start)}: ${point.status === 'empty' ? 'no calls' : formatRating(point.rubric_average)}`}
                >
                  <VStack spacing={1} flex={1} maxW='40px' cursor='pointer' onClick={() => onOpenReport(point.id)}>
                    <Box
                      w='100%'
                      h={`${Math.max(((point.rubric_average ?? 0) / 5) * BAR_MAX_HEIGHT, 3)}px`}
                      bg={point.rubric_average === null ? colors.border : `${ratingScheme(point.rubric_average)}.400`}
                      borderRadius='sm'
                    />
                    <Text fontSize='2xs' color={colors.textSecondary} noOfLines={1}>
                      {formatDay(point.period_start)}
                    </Text>
                  </VStack>
                </Tooltip>
              ))}
            </Flex>
          </Box>
        </VStack>
      )}
    </Panel>
  );
};
