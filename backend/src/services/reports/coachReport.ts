/**
 * Weekly Coach Report
 *
 * Reads call summaries (never transcripts) for one coach's week:
 * - map: one LLM call per client (this week's summaries, last week's
 *   next_focus, the action items carried into the week)
 * - reduce: one LLM call over the client sections → rubric rating,
 *   improvements, attention
 * With few clients both steps collapse into one call (keeps local Ollama
 * runs short). Counts are computed here, names come from the DB, and every
 * cited ref is checked (see grounding.ts). A coach with no counted calls
 * gets an 'empty' report without an LLM call.
 */

import {
  ClientSection,
  CoachAssessment,
  CoachReportContent,
  CoachReportStats,
  RUBRIC,
  RUBRIC_KEYS,
  ReportCallRef,
  clientSectionSchema,
  coachAssessmentSchema,
  coachReportSchema,
  rubricAverage,
} from '../../schemas/coachReport';
import { CallSummary } from '../../schemas/callSummary';
import {
  OpenActionItems,
  Period,
  WeekCall,
  countExcludedCalls,
  getReportFor,
  listCoachWeekCalls,
  listOpenActionItems,
  shiftPeriod,
} from '../../db/reportsRepo';
import { CoachRow, ReportStatus } from '../../types/pipeline';
import { RefMap, generateChecked, percent, talkShare, unknownRefs } from './grounding';

/** Up to this many clients, map and reduce run as one LLM call */
const SINGLE_CALL_MAX_CLIENTS = 3;

export interface GeneratedReport<C> {
  status: ReportStatus;
  content: C;
  provider: string;
  model: string;
}

type CountedCall = WeekCall & { client_id: string; client_name: string; summary: CallSummary };

interface ClientWeek {
  clientId: string;
  clientName: string;
  calls: CountedCall[];
  previousFocus: string | null;
  open: OpenActionItems | null;
}

const RUBRIC_TEXT = RUBRIC.map(
  (d) => `- ${d.key} (${d.label}): ${d.description}`,
).join('\n');

const SYSTEM_PROMPT = `You write the weekly report for a business coach, from summaries of their coaching calls.

Rules:
- Use only facts in the input. Never invent calls, clients, numbers or quotes. Do not restate counts; they are shown separately.
- Refer to calls and clients only by the refs given in the input (e.g. "call-2", "client-1"), written exactly as given.
- Judge progress against last week's focus and the action items carried into the week, when they are given.
- Be specific and constructive; write for the coach.

Coach rating rubric (score each dimension 1-5, where 3 is solid and 5 is exceptional; cite the calls that justify the score):
${RUBRIC_TEXT}`;

const isCounted = (call: WeekCall): call is CountedCall =>
  (call.status === 'summarized' || call.status === 'posted') &&
  call.summary !== null &&
  call.client_id !== null &&
  call.client_name !== null;

const formatActionItems = (items: CallSummary['action_items']): string =>
  items.length === 0
    ? 'none'
    : items
        .map((i) => `[${i.owner_role}] ${i.owner}: ${i.task}${i.due ? ` (due ${i.due})` : ''}`)
        .join('; ');

const formatCall = (call: CountedCall, ref: string, coachName: string): string => {
  const { coachWords, totalWords } = talkShare(call.transcript, coachName);
  const s = call.summary;
  return [
    `Call ${ref} · ${call.call_date} · ${call.title ?? 'Untitled'} · client sentiment: ${s.client_sentiment} · coach talk share: ${percent(totalWords ? coachWords / totalWords : null)}`,
    `Overview: ${s.overview}`,
    s.key_points.length > 0 && `Key points: ${s.key_points.join('; ')}`,
    `Action items: ${formatActionItems(s.action_items)}`,
    s.risks.length > 0 && `Risks: ${s.risks.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const formatClientWeek = (
  week: ClientWeek,
  clientRef: string,
  callRefs: RefMap,
  coachName: string,
): string =>
  [
    `## Client ${clientRef}: ${week.clientName}`,
    `Last week's focus: ${week.previousFocus ?? 'none recorded'}`,
    week.open
      ? `Action items carried in from the last call before this week (${week.open.call_date}): ${formatActionItems(week.open.action_items)}`
      : 'Action items carried in: none recorded',
    'Calls this week:',
    ...week.calls.map((c) => formatCall(c, callRefs.ref(c.call_id), coachName)),
  ].join('\n');

const computeStats = (
  coach: CoachRow,
  counted: CountedCall[],
  open: OpenActionItems[],
  excluded: number,
): CoachReportStats => {
  const sentiment = { positive: 0, neutral: 0, mixed: 0, negative: 0 };
  const actionItems = { coach: 0, client: 0, other: 0 };
  let coachWords = 0;
  let totalWords = 0;

  for (const call of counted) {
    sentiment[call.summary.client_sentiment] += 1;
    for (const item of call.summary.action_items) actionItems[item.owner_role] += 1;
    const share = talkShare(call.transcript, coach.name);
    coachWords += share.coachWords;
    totalWords += share.totalWords;
  }

  return {
    calls: counted.length,
    clients: new Set(counted.map((c) => c.client_id)).size,
    sentiment,
    action_items: actionItems,
    overdue_action_items: open.reduce(
      (sum, o) => sum + o.action_items.filter((i) => i.due !== null).length,
      0,
    ),
    excluded_calls: excluded,
    coach_talk_share:
      totalWords > 0 ? Math.round((coachWords / totalWords) * 100) / 100 : null,
    rubric_average: null,
  };
};

// Grounding checks (problems are fed back to the model on retry)

const checkSection = (
  section: ClientSection,
  allowedCalls: Set<string>,
): string[] => {
  const unknown = section.evidence_call_ids.filter(
    (ref) => !allowedCalls.has(ref.trim().toLowerCase()),
  );
  return unknown.length > 0
    ? [`Client ${section.client_id}: evidence_call_ids ${unknown.join(', ')} are not calls of this client`]
    : [];
};

const checkAssessment = (
  assessment: CoachAssessment,
  callRefs: RefMap,
): string[] => {
  const problems: string[] = [];
  const keys = assessment.coach_rating.dimensions.map((d) => d.key);
  const missing = RUBRIC_KEYS.filter((k) => !keys.includes(k));
  const duplicated = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (missing.length > 0) problems.push(`coach_rating is missing dimensions: ${missing.join(', ')}`);
  if (duplicated.length > 0) problems.push(`coach_rating repeats dimensions: ${duplicated.join(', ')}`);

  const unknown = unknownRefs(
    assessment.coach_rating.dimensions.flatMap((d) => d.evidence.map((e) => e.call_id)),
    callRefs,
  );
  if (unknown.length > 0) problems.push(`coach_rating cites unknown calls: ${unknown.join(', ')}`);
  return problems;
};

// Generation

interface Generated {
  sections: ClientSection[];
  assessment: CoachAssessment;
  provider: string;
  model: string;
}

const generateSingle = async (
  coach: CoachRow,
  weeks: ClientWeek[],
  clientRefs: RefMap,
  callRefs: RefMap,
  statsText: string,
): Promise<Generated> => {
  const expectedClients = weeks.map((w) => clientRefs.ref(w.clientId));
  const callsByClient = new Map(
    weeks.map((w) => [clientRefs.ref(w.clientId), new Set(w.calls.map((c) => callRefs.ref(c.call_id)))]),
  );

  const prompt = [
    `Coach: ${coach.name}`,
    statsText,
    ...weeks.map((w) => formatClientWeek(w, clientRefs.ref(w.clientId), callRefs, coach.name)),
    `Write one per_client entry for each client (${expectedClients.join(', ')}), then the coach rating, improvements and attention items.`,
  ].join('\n\n');

  const result = await generateChecked({
    task: `coach-report:${coach.id}`,
    system: SYSTEM_PROMPT,
    prompt,
    schema: coachReportSchema,
    check: (data) => {
      const problems = checkAssessment(data, callRefs);
      const given = data.per_client.map((s) => s.client_id.trim().toLowerCase());
      const missing = expectedClients.filter((ref) => !given.includes(ref));
      const extra = given.filter((ref) => !expectedClients.includes(ref) || given.indexOf(ref) !== given.lastIndexOf(ref));
      if (missing.length > 0) problems.push(`per_client is missing clients: ${missing.join(', ')}`);
      if (extra.length > 0) problems.push(`per_client has unknown or repeated clients: ${extra.join(', ')}`);
      for (const section of data.per_client) {
        const allowed = callsByClient.get(section.client_id.trim().toLowerCase());
        if (allowed) problems.push(...checkSection(section, allowed));
      }
      return problems;
    },
  });

  const { per_client, ...assessment } = result.data;
  return { sections: per_client, assessment, provider: result.provider, model: result.model };
};

const generateMapReduce = async (
  coach: CoachRow,
  weeks: ClientWeek[],
  clientRefs: RefMap,
  callRefs: RefMap,
  statsText: string,
): Promise<Generated> => {
  const sections: ClientSection[] = [];

  // Map: one call per client; client_id is set by code, not the model
  for (const week of weeks) {
    const clientRef = clientRefs.ref(week.clientId);
    const allowed = new Set(week.calls.map((c) => callRefs.ref(c.call_id)));
    const result = await generateChecked({
      task: `coach-report:${coach.id}:${clientRef}`,
      system: SYSTEM_PROMPT,
      prompt: `Coach: ${coach.name}\n\n${formatClientWeek(week, clientRef, callRefs, coach.name)}\n\nWrite the section for client ${clientRef}.`,
      schema: clientSectionSchema,
      check: (data) => checkSection(data, allowed),
    });
    sections.push({ ...result.data, client_id: clientRef });
  }

  // Reduce: coach-level judgments from the sections plus compact call facts
  const callLines = weeks.flatMap((w) =>
    w.calls.map((c) => {
      const share = talkShare(c.transcript, coach.name);
      return `- ${callRefs.ref(c.call_id)} (${clientRefs.ref(w.clientId)}, ${c.call_date}): ${c.summary.overview} Action items: ${formatActionItems(c.summary.action_items)}. Coach talk share: ${percent(share.totalWords ? share.coachWords / share.totalWords : null)}.`;
    }),
  );
  const sectionLines = sections.map(
    (s) => `## ${s.client_id}\nProgress: ${s.progress}\nNext focus: ${s.next_focus}\nWatch-outs: ${s.watch_outs.join('; ') || 'none'}`,
  );

  const result = await generateChecked({
    task: `coach-report:${coach.id}:assessment`,
    system: SYSTEM_PROMPT,
    prompt: [
      `Coach: ${coach.name}`,
      statsText,
      'Client sections:',
      ...sectionLines,
      'Calls this week:',
      ...callLines,
      'Write the coach rating, improvements and attention items.',
    ].join('\n\n'),
    schema: coachAssessmentSchema,
    check: (data) => checkAssessment(data, callRefs),
  });

  return { sections, assessment: result.data, provider: result.provider, model: result.model };
};

/** Maps model refs back to IDs and adds names from the DB */
const resolveOutput = (
  generated: Generated,
  weeks: ClientWeek[],
  clientRefs: RefMap,
  callRefs: RefMap,
): Pick<CoachReportContent, 'per_client' | 'coach_rating' | 'improvements' | 'attention'> => {
  const names = new Map(weeks.map((w) => [w.clientId, w.clientName]));
  const resolveCall = (ref: string) => callRefs.resolve(ref) ?? ref;

  return {
    per_client: generated.sections.map((s) => {
      const clientId = clientRefs.resolve(s.client_id) ?? s.client_id;
      return {
        ...s,
        client_id: clientId,
        client_name: names.get(clientId) ?? 'Unknown client',
        evidence_call_ids: s.evidence_call_ids.map(resolveCall),
      };
    }),
    coach_rating: {
      ...generated.assessment.coach_rating,
      // Rubric order, whatever order the model used
      dimensions: RUBRIC_KEYS.flatMap((key) =>
        generated.assessment.coach_rating.dimensions
          .filter((d) => d.key === key)
          .slice(0, 1)
          .map((d) => ({
            ...d,
            evidence: d.evidence.map((e) => ({ ...e, call_id: resolveCall(e.call_id) })),
          })),
      ),
    },
    improvements: generated.assessment.improvements,
    attention: generated.assessment.attention,
  };
};

export const generateCoachReport = async (
  coach: CoachRow,
  period: Period,
): Promise<GeneratedReport<CoachReportContent>> => {
  const [weekCalls, open, excluded, previous] = await Promise.all([
    listCoachWeekCalls(coach.id, period),
    listOpenActionItems(coach.id, period),
    countExcludedCalls(period, coach.id),
    getReportFor('coach', coach.id, shiftPeriod(period, -1).periodStart),
  ]);

  const counted = weekCalls.filter(isCounted);
  const stats = computeStats(coach, counted, open, excluded);
  const calls: ReportCallRef[] = counted.map((c) => ({
    id: c.call_id,
    client_id: c.client_id,
    title: c.title,
    date: c.call_date,
    sentiment: c.summary.client_sentiment,
  }));

  if (counted.length === 0) {
    return { status: 'empty', content: { stats, calls }, provider: 'none', model: 'none' };
  }

  const previousFocus = new Map(
    ((previous?.content as CoachReportContent | undefined)?.per_client ?? []).map(
      (s) => [s.client_id, s.next_focus],
    ),
  );
  const openByClient = new Map(open.map((o) => [o.client_id, o]));
  const weeks: ClientWeek[] = [];
  for (const call of counted) {
    let week = weeks.find((w) => w.clientId === call.client_id);
    if (!week) {
      week = {
        clientId: call.client_id,
        clientName: call.client_name,
        calls: [],
        previousFocus: previousFocus.get(call.client_id) ?? null,
        open: openByClient.get(call.client_id) ?? null,
      };
      weeks.push(week);
    }
    week.calls.push(call);
  }

  const clientRefs = new RefMap('client');
  const callRefs = new RefMap('call');
  weeks.forEach((w) => {
    clientRefs.ref(w.clientId);
    w.calls.forEach((c) => callRefs.ref(c.call_id));
  });

  const statsText = `This week (${period.periodStart} to ${period.periodEnd}): ${stats.calls} calls with ${stats.clients} clients. Coach talk share overall: ${percent(stats.coach_talk_share)}. Action items with a deadline carried in from earlier weeks: ${stats.overdue_action_items}.`;

  const generated =
    weeks.length <= SINGLE_CALL_MAX_CLIENTS
      ? await generateSingle(coach, weeks, clientRefs, callRefs, statsText)
      : await generateMapReduce(coach, weeks, clientRefs, callRefs, statsText);

  const output = resolveOutput(generated, weeks, clientRefs, callRefs);
  return {
    status: 'ready',
    content: {
      stats: { ...stats, rubric_average: rubricAverage(output.coach_rating?.dimensions) },
      calls,
      ...output,
    },
    provider: generated.provider,
    model: generated.model,
  };
};
