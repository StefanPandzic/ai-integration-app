/**
 * Weekly Manager Report
 *
 * One LLM call over the week's coach reports (never transcripts or call
 * summaries) plus SQL stats. Sentiment, call counts, rubric averages and
 * week-over-week deltas are computed here; the LLM explains them and
 * writes trends, concerns, content ideas, at-risk clients and one line per
 * coach. Every client/coach ref it cites is checked (see grounding.ts).
 */

import { CoachReportContent } from '../../schemas/coachReport';
import {
  CoachRef,
  CoachWeekStats,
  ManagerReportContent,
  ManagerReportStats,
  SentimentCounts,
  WeekTotals,
  managerReportSchema,
} from '../../schemas/managerReport';
import {
  CoachWeekCounts,
  Period,
  ReportListItem,
  countExcludedCalls,
  getReport,
  listCoachWeekCounts,
  listReports,
  shiftPeriod,
} from '../../db/reportsRepo';
import { GeneratedReport } from './coachReport';
import { RefMap, generateChecked, percent, unknownRefs } from './grounding';

const SYSTEM_PROMPT = `You write the weekly portfolio report for the manager of a business coaching team, from the coaches' weekly reports.

Rules:
- Use only facts in the input. Never invent clients, coaches, numbers or quotes. Numbers are computed separately and shown to the manager; you may refer to them but never compute new ones.
- Refer to clients and coaches only by the refs given in the input (e.g. "client-2", "coach-1"), written exactly as given.
- trends: patterns across several clients or coaches, not a recap of one call.
- client_concerns: what clients are worried about, each with the clients who raised it.
- content_ideas: marketing or content ideas (posts, workshops, guides) grounded in what clients discussed, each with the clients behind it.
- at_risk_clients: clients whose progress, sentiment or engagement is at risk, with the reason.
- coach_highlights: exactly one short line per coach in the input.`;

const emptySentiment = (): SentimentCounts => ({
  positive: 0,
  neutral: 0,
  mixed: 0,
  negative: 0,
});

const round1 = (value: number): number => Math.round(value * 10) / 10;

const average = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0
    ? round1(present.reduce((sum, v) => sum + v, 0) / present.length)
    : null;
};

const totals = (
  counts: CoachWeekCounts[],
  reports: ReportListItem[],
): WeekTotals => {
  const sentiment = emptySentiment();
  for (const row of counts) {
    sentiment.positive += row.positive;
    sentiment.neutral += row.neutral;
    sentiment.mixed += row.mixed;
    sentiment.negative += row.negative;
  }
  return {
    calls: counts.reduce((sum, row) => sum + row.calls, 0),
    sentiment,
    rubric_average: average(reports.map((r) => r.rubric_average)),
  };
};

const computeStats = async (
  period: Period,
  coachReports: ReportListItem[],
  missing: CoachRef[],
): Promise<ManagerReportStats> => {
  const previousPeriod = shiftPeriod(period, -1);
  const [counts, previousCounts, previousReports, excluded] = await Promise.all([
    listCoachWeekCounts(period),
    listCoachWeekCounts(previousPeriod),
    listReports({ type: 'coach', periodStart: previousPeriod.periodStart }),
    countExcludedCalls(period),
  ]);

  const current = totals(counts, coachReports);
  const previous = totals(previousCounts, previousReports);
  const reportByCoach = new Map(coachReports.map((r) => [r.coach_id, r]));

  const perCoach: CoachWeekStats[] = counts.map((row) => ({
    coach_id: row.coach_id,
    coach_name: row.coach_name,
    calls: row.calls,
    clients: row.clients,
    sentiment: {
      positive: row.positive,
      neutral: row.neutral,
      mixed: row.mixed,
      negative: row.negative,
    },
    rubric_average: reportByCoach.get(row.coach_id)?.rubric_average ?? null,
    report_id: reportByCoach.get(row.coach_id)?.id ?? null,
  }));

  const sentimentDelta = emptySentiment();
  for (const key of Object.keys(sentimentDelta) as (keyof SentimentCounts)[]) {
    sentimentDelta[key] = current.sentiment[key] - previous.sentiment[key];
  }

  return {
    ...current,
    clients: counts.reduce((sum, row) => sum + row.clients, 0),
    per_coach: perCoach,
    previous,
    deltas: {
      calls: current.calls - previous.calls,
      sentiment: sentimentDelta,
      rubric_average:
        current.rubric_average !== null && previous.rubric_average !== null
          ? round1(current.rubric_average - previous.rubric_average)
          : null,
    },
    coaches_without_calls: counts
      .filter((row) => row.calls === 0)
      .map(({ coach_id, coach_name }) => ({ coach_id, coach_name })),
    coach_reports_missing: missing,
    excluded_calls: excluded,
  };
};

const formatSentiment = (s: SentimentCounts): string =>
  `${s.positive} positive, ${s.neutral} neutral, ${s.mixed} mixed, ${s.negative} negative`;

const formatCoachReport = (
  coachRef: string,
  coachName: string,
  content: CoachReportContent,
  clientRefs: RefMap,
): string => {
  const { stats } = content;
  const lines = [
    `## Coach ${coachRef}: ${coachName}`,
    `${stats.calls} calls, ${stats.clients} clients, rubric average ${stats.rubric_average ?? 'n/a'}/5, coach talk share ${percent(stats.coach_talk_share)}`,
    content.coach_rating && `Rating comment: ${content.coach_rating.overall_comment}`,
    content.improvements?.length &&
      `Improvements: ${content.improvements.map((i) => `${i.dimension}: ${i.suggestion}`).join('; ')}`,
    content.attention?.length && `Attention: ${content.attention.join('; ')}`,
  ];

  for (const section of content.per_client ?? []) {
    const sentiments = content.calls
      .filter((c) => c.client_id === section.client_id)
      .map((c) => c.sentiment);
    lines.push(
      [
        `### Client ${clientRefs.ref(section.client_id)}: ${section.client_name} (sentiment this week: ${sentiments.join(', ') || 'n/a'})`,
        `Progress: ${section.progress}`,
        `Next focus: ${section.next_focus}`,
        section.watch_outs.length > 0 && `Watch-outs: ${section.watch_outs.join('; ')}`,
        section.key_topics?.length && `Topics: ${section.key_topics.join('; ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return lines.filter(Boolean).join('\n');
};

export const generateManagerReport = async (
  period: Period,
  missing: CoachRef[],
): Promise<GeneratedReport<ManagerReportContent>> => {
  const coachReports = await listReports({
    type: 'coach',
    periodStart: period.periodStart,
  });
  const stats = await computeStats(period, coachReports, missing);

  const ready = await Promise.all(
    coachReports
      .filter((r) => r.status === 'ready')
      .map((r) => getReport(r.id)),
  );
  const inputs = ready.flatMap((r) =>
    r && r.coach_id
      ? [{ coachId: r.coach_id, coachName: r.coach_name ?? 'Coach', content: r.content as unknown as CoachReportContent }]
      : [],
  );

  if (inputs.length === 0) {
    return {
      status: 'empty',
      content: { stats, client_names: {} },
      provider: 'none',
      model: 'none',
    };
  }

  const coachRefs = new RefMap('coach');
  const clientRefs = new RefMap('client');
  const clientNames: Record<string, string> = {};
  for (const input of inputs) {
    coachRefs.ref(input.coachId);
    for (const section of input.content.per_client ?? []) {
      clientRefs.ref(section.client_id);
      clientNames[section.client_id] = section.client_name;
    }
  }

  const prompt = [
    `Week ${period.periodStart} to ${period.periodEnd}.`,
    `Portfolio numbers (computed; for context): ${stats.calls} calls (${stats.deltas.calls >= 0 ? '+' : ''}${stats.deltas.calls} vs last week). Client sentiment this week: ${formatSentiment(stats.sentiment)}; last week: ${formatSentiment(stats.previous.sentiment)}. Average coach rating ${stats.rubric_average ?? 'n/a'}/5 (last week ${stats.previous.rubric_average ?? 'n/a'}).`,
    stats.coaches_without_calls.length > 0 &&
      `Coaches with no calls this week: ${stats.coaches_without_calls.map((c) => c.coach_name).join(', ')}.`,
    ...inputs.map((i) =>
      formatCoachReport(coachRefs.ref(i.coachId), i.coachName, i.content, clientRefs),
    ),
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await generateChecked({
    task: `manager-report:${period.periodStart}`,
    system: SYSTEM_PROMPT,
    prompt,
    schema: managerReportSchema,
    check: (data) => {
      const problems: string[] = [];
      const clients = unknownRefs(
        [
          ...data.client_concerns.flatMap((c) => c.client_ids),
          ...data.content_ideas.flatMap((c) => c.client_ids),
          ...data.at_risk_clients.map((c) => c.client_id),
        ],
        clientRefs,
      );
      const coaches = unknownRefs(
        data.coach_highlights.map((h) => h.coach_id),
        coachRefs,
      );
      if (clients.length > 0) problems.push(`Unknown client refs: ${[...new Set(clients)].join(', ')}`);
      if (coaches.length > 0) problems.push(`Unknown coach refs: ${[...new Set(coaches)].join(', ')}`);
      return problems;
    },
  });

  const toClient = (ref: string) => clientRefs.resolve(ref) ?? ref;
  const data = result.data;
  return {
    status: 'ready',
    content: {
      stats,
      client_names: clientNames,
      trends: data.trends,
      sentiment_notes: data.sentiment_notes,
      client_concerns: data.client_concerns.map((c) => ({
        ...c,
        client_ids: [...new Set(c.client_ids.map(toClient))],
      })),
      content_ideas: data.content_ideas.map((c) => ({
        ...c,
        client_ids: [...new Set(c.client_ids.map(toClient))],
      })),
      at_risk_clients: data.at_risk_clients.map((c) => ({
        ...c,
        client_id: toClient(c.client_id),
      })),
      coach_highlights: data.coach_highlights.map((h) => ({
        ...h,
        coach_id: coachRefs.resolve(h.coach_id) ?? h.coach_id,
      })),
    },
    provider: result.provider,
    model: result.model,
  };
};
