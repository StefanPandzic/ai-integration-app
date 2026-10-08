import { Button, HStack, Text } from '@chakra-ui/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useNavigate, useParams } from 'react-router-dom';
import { BackLink, PageHeader, QueryState } from '../components';
import { useAppColors } from '../constants/colors';
import {
  CoachReportView,
  ManagerReportView,
  formatPeriod,
  useGetReportQuery,
} from '../features/reports';

export const ReportDetailPage = () => {
  const colors = useAppColors();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetReportQuery(reportId ?? skipToken);
  const report = data?.report;

  const title = !report
    ? 'Report'
    : report.type === 'manager'
      ? 'Manager overview'
      : `Weekly report: ${report.coach_name ?? 'Coach'}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <BackLink
            to={report ? `/reports?period=${report.period_start}` : '/reports'}
            label='Reports'
          />
        }
        title={title}
        subtitle={
          report && (
            <>
              Week of {formatPeriod(report.period_start, report.period_end)}
              <Text as='span' fontSize='xs' color={colors.textSecondary}>
                {' '}
                · {report.provider === 'none' ? 'no LLM call (no calls)' : `${report.provider}/${report.model}`}
              </Text>
            </>
          )
        }
        actions={
          data && (
            <HStack spacing={2}>
              {!data.outbox.drive && data.report.drive_url ? (
                <Button
                  as='a'
                  size='sm'
                  variant='outline'
                  href={data.report.drive_url}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Drive document
                </Button>
              ) : (
                <Button
                  size='sm'
                  variant='outline'
                  isDisabled={!data.outbox.drive}
                  onClick={() => navigate(`/outbox?tab=drive&item=${data.outbox.drive}`)}
                >
                  Drive document
                </Button>
              )}
              <Button
                size='sm'
                variant='outline'
                isDisabled={!data.outbox.slack}
                onClick={() => navigate(`/outbox?tab=slack&item=${data.outbox.slack}`)}
              >
                Slack message
              </Button>
            </HStack>
          )
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {report?.type === 'coach' && (
          <CoachReportView
            status={report.status}
            content={report.content}
            onOpenCall={(id) => navigate(`/calls/${id}`)}
            onOpenClient={(id) => navigate(`/clients/${id}`)}
          />
        )}
        {report?.type === 'manager' && (
          <ManagerReportView
            status={report.status}
            content={report.content}
            onOpenClient={(id) => navigate(`/clients/${id}`)}
            onOpenCoach={(id) => navigate(`/coaches/${id}`)}
            onOpenReport={(id) => navigate(`/reports/${id}`)}
          />
        )}
      </QueryState>
    </>
  );
};
