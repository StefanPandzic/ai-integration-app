/**
 * Weekly Reports and Ops Alerts → Slack Block Kit
 *
 * Report messages stay short: headline numbers, rating, the top 3 items
 * and links to the full report (Drive document and dashboard).
 */

import { CoachReportContent, RUBRIC } from '../../schemas/coachReport';
import { ManagerReportContent } from '../../schemas/managerReport';
import { ReportStatus } from '../../types/pipeline';
import {
  bullets,
  context,
  escape,
  fields,
  header,
  linkButton,
  section,
} from './blockKit';
import { SlackMessage } from './slackClient';

const TOP_ITEMS = 3;

const signed = (n: number | null): string =>
  n === null ? '' : ` (${n > 0 ? '+' : ''}${n})`;

const rating = (avg: number | null): string =>
  avg === null ? 'n/a' : `${avg}/5`;

interface ReportLinks {
  driveUrl: string | null;
  dashboardUrl: string;
}

const links = ({ driveUrl, dashboardUrl }: ReportLinks) => [
  linkButton('Full report', driveUrl ?? dashboardUrl),
  context(`<${dashboardUrl}|Open in dashboard>`),
];

export const buildCoachReportMessage = (
  channel: string,
  coachName: string,
  periodLabel: string,
  status: ReportStatus,
  content: CoachReportContent,
  reportLinks: ReportLinks,
): SlackMessage => {
  const { stats } = content;
  // Named, since it lands in the manager channel when the coach has no Slack user
  const title = `Weekly report: ${coachName} · ${periodLabel}`;

  if (status === 'empty') {
    return {
      channel,
      text: `${title}: no calls`,
      blocks: [
        header(`📋 ${title}`),
        section(
          `No summarized calls were recorded last week${stats.excluded_calls > 0 ? ` (${stats.excluded_calls} still processing, in review or failed)` : ''}.`,
        ),
        ...links(reportLinks),
      ],
    };
  }

  const rubricLabel = new Map<string, string>(RUBRIC.map((d) => [d.key, d.label]));
  const top = [
    ...(content.attention ?? []),
    ...(content.improvements ?? []).map(
      (i) => `${rubricLabel.get(i.dimension) ?? i.dimension}: ${i.suggestion}`,
    ),
  ].slice(0, TOP_ITEMS);

  return {
    channel,
    text: `${title}: ${stats.calls} calls, rating ${rating(stats.rubric_average)}`,
    blocks: [
      header(`📋 ${title}`),
      fields([
        ['Calls', String(stats.calls)],
        ['Clients', String(stats.clients)],
        ['Rating', rating(stats.rubric_average)],
        ['Negative calls', String(stats.sentiment.negative)],
      ]),
      ...(top.length > 0 ? [section(`*Top items this week*\n${bullets(top)}`)] : []),
      ...links(reportLinks),
    ],
  };
};

export const buildManagerReportMessage = (
  channel: string,
  periodLabel: string,
  status: ReportStatus,
  content: ManagerReportContent,
  reportLinks: ReportLinks,
): SlackMessage => {
  const { stats } = content;
  const title = `Weekly coaching overview · ${periodLabel}`;
  const missing =
    stats.coach_reports_missing.length > 0
      ? [
          section(
            `:warning: *Missing coach reports:* ${escape(stats.coach_reports_missing.map((c) => c.coach_name).join(', '))}`,
          ),
        ]
      : [];

  const top = [
    ...(content.at_risk_clients ?? []).map(
      (c) => `At risk: ${content.client_names[c.client_id] ?? 'client'}: ${c.reason}`,
    ),
    ...(content.trends ?? []),
  ].slice(0, TOP_ITEMS);

  return {
    channel,
    text: `${title}: ${stats.calls} calls, avg rating ${rating(stats.rubric_average)}`,
    blocks: [
      header(`📊 ${title}`),
      fields([
        ['Calls', `${stats.calls}${signed(stats.deltas.calls)}`],
        ['Avg rating', `${rating(stats.rubric_average)}${signed(stats.deltas.rubric_average)}`],
        ['Negative calls', `${stats.sentiment.negative}${signed(stats.deltas.sentiment.negative)}`],
        ['Excluded calls', String(stats.excluded_calls)],
      ]),
      ...missing,
      ...(status === 'empty'
        ? [section('No coach reports with calls this week.')]
        : top.length > 0
          ? [section(`*Top items*\n${bullets(top)}`)]
          : []),
      ...links(reportLinks),
    ],
  };
};

export const buildOpsAlert = (
  channel: string,
  title: string,
  lines: string[],
  link?: { text: string; url: string },
): SlackMessage => ({
  channel,
  text: `🚨 ${title}`,
  blocks: [
    header(`🚨 ${title}`),
    section(lines.map(escape).join('\n')),
    ...(link ? [linkButton(link.text, link.url)] : []),
  ],
});
