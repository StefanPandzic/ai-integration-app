/**
 * Reports Repository: report periods, weekly stats, reports and run state
 *
 * A week runs Monday 00:00 to Sunday 23:59 in America/Chicago. A call
 * belongs to the week of its started_at (else created_at); only
 * summarized or posted calls are counted, the rest are "excluded".
 * Period dates travel as 'YYYY-MM-DD' strings.
 */

import { REPORTS_TIMEZONE } from '../config/integrations';
import { ActionItem, CallSummary } from '../schemas/callSummary';
import {
  CallStatus,
  CoachRow,
  JobStatus,
  Participant,
  ReportRow,
  ReportStatus,
  ReportType,
} from '../types/pipeline';
import { query } from './index';

export interface Period {
  periodStart: string;
  periodEnd: string;
}

const TZ = `'${REPORTS_TIMEZONE}'`;

/** SQL: the local (Chicago) date a call happened on */
const callLocalDate = (alias: string): string =>
  `(coalesce(${alias}.started_at, ${alias}.created_at) at time zone ${TZ})::date`;

const inPeriod = (alias: string, startParam: string, endParam: string) =>
  `${callLocalDate(alias)} between ${startParam}::date and ${endParam}::date`;

const COUNTED_STATUSES: CallStatus[] = ['summarized', 'posted'];
const EXCLUDED_STATUSES: CallStatus[] = ['received', 'needs_review', 'failed'];

/** Adds whole weeks to a period ('YYYY-MM-DD' arithmetic in UTC) */
export const shiftPeriod = (period: Period, weeks: number): Period => {
  const shift = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + weeks * 7);
    return d.toISOString().slice(0, 10);
  };
  return {
    periodStart: shift(period.periodStart),
    periodEnd: shift(period.periodEnd),
  };
};

/**
 * The Monday-Sunday week containing `date`, or the previous full week
 * (Chicago time) when no date is given.
 */
export const getPeriod = async (date?: string | null): Promise<Period> => {
  const [row] = await query<{ period_start: string; period_end: string }>(
    `select to_char(ws, 'YYYY-MM-DD') as period_start,
            to_char(ws + 6, 'YYYY-MM-DD') as period_end
       from (
         select case
                  when $1::date is not null
                    then $1::date - (extract(isodow from $1::date)::int - 1)
                  else today - (extract(isodow from today)::int - 1) - 7
                end as ws
           from (select (now() at time zone ${TZ})::date as today) t
       ) w`,
    [date ?? null],
  );
  return { periodStart: row.period_start, periodEnd: row.period_end };
};

/** Last week's period, and whether this week's Monday 7:00 CT has passed */
export const getCatchUpState = async (): Promise<{
  period: Period;
  due: boolean;
}> => {
  const period = await getPeriod();
  const [row] = await query<{ due: boolean }>(
    `select (now() at time zone ${TZ}) >=
              ($1::date + 7 + interval '7 hours') as due`,
    [period.periodStart],
  );
  return { period, due: row.due };
};

/** Chicago-local timestamps (ISO) for [dayOffset, hour] slots from a date */
export const localTimestamps = async (
  startDate: string,
  slots: { dayOffset: number; hour: number }[],
): Promise<string[]> =>
  (
    await query<{ ts: Date }>(
      `select (($1::date + d) + make_interval(hours => h)) at time zone ${TZ} as ts
         from unnest($2::int[], $3::int[]) with ordinality as s(d, h, n)
        order by n`,
      [startDate, slots.map((s) => s.dayOffset), slots.map((s) => s.hour)],
    )
  ).map((row) => row.ts.toISOString());

export const listCoachesWithClients = (): Promise<CoachRow[]> =>
  query<CoachRow>(
    `select co.* from coaches co
      where exists (select 1 from clients cl where cl.coach_id = co.id)
      order by co.name`,
  );

export interface WeekCall {
  call_id: string;
  client_id: string | null;
  client_name: string | null;
  title: string | null;
  call_date: string;
  status: CallStatus;
  participants: Participant[];
  transcript: string;
  summary: CallSummary | null;
}

/** All of a coach's calls in the week (any status), oldest first */
export const listCoachWeekCalls = (
  coachId: string,
  period: Period,
): Promise<WeekCall[]> =>
  query<WeekCall>(
    `select ca.id as call_id, ca.client_id, cl.name as client_name, ca.title,
            to_char(${callLocalDate('ca')}, 'YYYY-MM-DD') as call_date,
            ca.status, ca.participants, ca.transcript, cs.summary
       from calls ca
       left join clients cl on cl.id = ca.client_id
       left join call_summaries cs on cs.call_id = ca.id
      where ca.coach_id = $1 and ${inPeriod('ca', '$2', '$3')}
      order by coalesce(ca.started_at, ca.created_at)`,
    [coachId, period.periodStart, period.periodEnd],
  );

export interface OpenActionItems {
  client_id: string;
  call_id: string;
  call_date: string;
  action_items: ActionItem[];
}

/**
 * Commitments carried into the week: the action items from each client's
 * last summarized call before the period.
 */
export const listOpenActionItems = (
  coachId: string,
  period: Period,
): Promise<OpenActionItems[]> =>
  query<OpenActionItems>(
    `select distinct on (ca.client_id)
            ca.client_id, ca.id as call_id,
            to_char(${callLocalDate('ca')}, 'YYYY-MM-DD') as call_date,
            cs.summary->'action_items' as action_items
       from calls ca
       join call_summaries cs on cs.call_id = ca.id
      where ca.coach_id = $1 and ca.client_id is not null
        and ${callLocalDate('ca')} < $2::date
      order by ca.client_id, coalesce(ca.started_at, ca.created_at) desc`,
    [coachId, period.periodStart],
  );

/** Calls in the week that the pipeline is still working on */
export const countInFlightCalls = async (period: Period): Promise<number> =>
  (
    await query<{ count: number }>(
      `select count(*)::int as count from calls ca
        where ca.status = 'received' and ${inPeriod('ca', '$1', '$2')}`,
      [period.periodStart, period.periodEnd],
    )
  )[0].count;

export const countExcludedCalls = async (
  period: Period,
  coachId: string | null = null,
): Promise<number> =>
  (
    await query<{ count: number }>(
      `select count(*)::int as count from calls ca
        where ca.status = any($3) and ${inPeriod('ca', '$1', '$2')}
          and ($4::uuid is null or ca.coach_id = $4)`,
      [period.periodStart, period.periodEnd, EXCLUDED_STATUSES, coachId],
    )
  )[0].count;

export interface CoachWeekCounts {
  coach_id: string;
  coach_name: string;
  calls: number;
  clients: number;
  positive: number;
  neutral: number;
  mixed: number;
  negative: number;
}

/** Counted calls and client sentiment per coach (every coach, 0 if none) */
export const listCoachWeekCounts = (
  period: Period,
): Promise<CoachWeekCounts[]> =>
  query<CoachWeekCounts>(
    `select co.id as coach_id, co.name as coach_name,
            count(ca.id)::int as calls,
            count(distinct ca.client_id)::int as clients,
            count(*) filter (where cs.summary->>'client_sentiment' = 'positive')::int as positive,
            count(*) filter (where cs.summary->>'client_sentiment' = 'neutral')::int as neutral,
            count(*) filter (where cs.summary->>'client_sentiment' = 'mixed')::int as mixed,
            count(*) filter (where cs.summary->>'client_sentiment' = 'negative')::int as negative
       from coaches co
       left join calls ca
         on ca.coach_id = co.id and ca.status = any($3)
        and ${inPeriod('ca', '$1', '$2')}
       left join call_summaries cs on cs.call_id = ca.id
      group by co.id, co.name
      order by co.name`,
    [period.periodStart, period.periodEnd, COUNTED_STATUSES],
  );

// Reports

const REPORT_COLUMNS = `r.id, r.type, r.coach_id,
  to_char(r.period_start, 'YYYY-MM-DD') as period_start,
  to_char(r.period_end, 'YYYY-MM-DD') as period_end,
  r.status, r.content, r.provider, r.model, r.slack_message_ts,
  r.drive_file_id, r.drive_url, r.created_at`;

export interface ReportInput {
  type: ReportType;
  coachId: string | null;
  period: Period;
  status: ReportStatus;
  content: object;
  provider: string;
  model: string;
}

/** Inserts or replaces the report for (type, coach, period) */
export const upsertReport = async (input: ReportInput): Promise<ReportRow> =>
  (
    await query<ReportRow>(
      `insert into reports as r (type, coach_id, period_start, period_end,
                                 status, content, provider, model)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (type, coach_id, period_start) do update
         set period_end = excluded.period_end, status = excluded.status,
             content = excluded.content, provider = excluded.provider,
             model = excluded.model, slack_message_ts = null,
             drive_file_id = null, drive_url = null, created_at = now()
       returning ${REPORT_COLUMNS}`,
      [
        input.type,
        input.coachId,
        input.period.periodStart,
        input.period.periodEnd,
        input.status,
        JSON.stringify(input.content),
        input.provider,
        input.model,
      ],
    )
  )[0];

export const getReportFor = async (
  type: ReportType,
  coachId: string | null,
  periodStart: string,
): Promise<ReportRow | null> =>
  (
    await query<ReportRow>(
      `select ${REPORT_COLUMNS} from reports r
        where r.type = $1 and r.coach_id is not distinct from $2
          and r.period_start = $3::date`,
      [type, coachId, periodStart],
    )
  )[0] ?? null;

export const deleteReport = async (id: string): Promise<void> => {
  await query('delete from reports where id = $1', [id]);
};

export const setReportSlackTs = async (
  id: string,
  ts: string,
): Promise<void> => {
  await query('update reports set slack_message_ts = $2 where id = $1', [
    id,
    ts,
  ]);
};

export const setReportDrive = async (
  id: string,
  fileId: string,
  url: string,
): Promise<void> => {
  await query(
    'update reports set drive_file_id = $2, drive_url = $3 where id = $1',
    [id, fileId, url],
  );
};

export interface ReportDetail extends ReportRow {
  coach_name: string | null;
}

export const getReport = async (id: string): Promise<ReportDetail | null> =>
  (
    await query<ReportDetail>(
      `select ${REPORT_COLUMNS}, co.name as coach_name
         from reports r left join coaches co on co.id = r.coach_id
        where r.id = $1`,
      [id],
    )
  )[0] ?? null;

export interface ReportListItem {
  id: string;
  type: ReportType;
  coach_id: string | null;
  coach_name: string | null;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  calls: number | null;
  rubric_average: number | null;
  slack_message_ts: string | null;
  drive_url: string | null;
  created_at: Date;
}

export interface ReportFilters {
  type?: ReportType | null;
  coachId?: string | null;
  periodStart?: string | null;
  limit?: number;
}

/** Newest period first, manager report before coach reports */
export const listReports = ({
  type = null,
  coachId = null,
  periodStart = null,
  limit = 100,
}: ReportFilters = {}): Promise<ReportListItem[]> =>
  query<ReportListItem>(
    `select r.id, r.type, r.coach_id, co.name as coach_name,
            to_char(r.period_start, 'YYYY-MM-DD') as period_start,
            to_char(r.period_end, 'YYYY-MM-DD') as period_end,
            r.status,
            (r.content->'stats'->>'calls')::int as calls,
            (r.content->'stats'->>'rubric_average')::float as rubric_average,
            r.slack_message_ts, r.drive_url, r.created_at
       from reports r left join coaches co on co.id = r.coach_id
      where ($1::text is null or r.type = $1)
        and ($2::uuid is null or r.coach_id = $2)
        and ($3::date is null or r.period_start = $3::date)
      order by r.period_start desc, r.type desc, co.name
      limit $4`,
    [type, coachId, periodStart, limit],
  );

// Runs

export type RunTrigger = 'cron' | 'catch-up' | 'manual';
export type RunState = 'running' | 'ok' | 'partial' | 'failed';

interface RunChildJob {
  type: 'coach_report' | 'manager_report';
  status: JobStatus;
  coach_id: string | null;
  coach_name: string | null;
  last_error: string | null;
}

interface RunJobRow {
  job_id: string;
  run_id: string;
  period_start: string;
  period_end: string;
  trigger: RunTrigger;
  status: JobStatus;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  children: RunChildJob[] | null;
}

export interface ReportRun {
  run_id: string;
  period_start: string;
  period_end: string;
  trigger: RunTrigger;
  state: RunState;
  created_at: Date;
  updated_at: Date;
  error: string | null;
  coach_jobs: { total: number; succeeded: number; dead: number; active: number };
  manager_job: JobStatus | null;
  missing_coaches: { coach_id: string; coach_name: string | null }[];
}

const isActive = (status: JobStatus) =>
  status === 'pending' || status === 'running';

const toRun = (row: RunJobRow): ReportRun => {
  const children = row.children ?? [];
  const coachJobs = children.filter((c) => c.type === 'coach_report');
  const manager = children.find((c) => c.type === 'manager_report') ?? null;
  const dead = coachJobs.filter((c) => c.status === 'dead');
  const anyActive =
    isActive(row.status) || children.some((c) => isActive(c.status));

  let state: RunState;
  if (row.status === 'dead' || manager?.status === 'dead') state = 'failed';
  else if (anyActive || !manager) state = 'running';
  else state = dead.length > 0 ? 'partial' : 'ok';

  const failedJob =
    row.status === 'dead'
      ? row
      : manager?.status === 'dead'
        ? manager
        : (dead[0] ?? null);

  return {
    run_id: row.run_id,
    period_start: row.period_start,
    period_end: row.period_end,
    trigger: row.trigger,
    state,
    created_at: row.created_at,
    updated_at: row.updated_at,
    error: failedJob?.last_error ?? null,
    coach_jobs: {
      total: coachJobs.length,
      succeeded: coachJobs.filter((c) => c.status === 'succeeded').length,
      dead: dead.length,
      active: coachJobs.filter((c) => isActive(c.status)).length,
    },
    manager_job: manager?.status ?? null,
    missing_coaches: dead.map((c) => ({
      coach_id: c.coach_id ?? '',
      coach_name: c.coach_name,
    })),
  };
};

const listRunRows = (runId: string | null, limit: number) =>
  query<RunJobRow>(
    `select w.id as job_id, w.payload->>'runId' as run_id,
            w.payload->>'periodStart' as period_start,
            w.payload->>'periodEnd' as period_end,
            coalesce(w.payload->>'trigger', 'cron') as trigger,
            w.status, w.last_error, w.created_at,
            greatest(w.updated_at, max(c.updated_at)) as updated_at,
            json_agg(json_build_object(
              'type', c.type, 'status', c.status,
              'coach_id', c.payload->>'coachId', 'coach_name', co.name,
              'last_error', c.last_error
            ) order by co.name) filter (where c.id is not null) as children
       from jobs w
       left join jobs c
         on c.payload->>'runId' = w.payload->>'runId'
        and c.type in ('coach_report', 'manager_report')
       left join coaches co on co.id::text = c.payload->>'coachId'
      where w.type = 'weekly_reports'
        and ($1::text is null or w.payload->>'runId' = $1)
      group by w.id
      order by w.created_at desc
      limit $2`,
    [runId, limit],
  );

export const listRuns = async (limit = 10): Promise<ReportRun[]> =>
  (await listRunRows(null, limit)).map(toRun);

export const getRunState = async (runId: string): Promise<ReportRun | null> => {
  const [row] = await listRunRows(runId, 1);
  return row ? toRun(row) : null;
};

/** Coach report jobs of a run (manager gate) */
export const listRunCoachJobs = (
  runId: string,
): Promise<{ coach_id: string; status: JobStatus }[]> =>
  query<{ coach_id: string; status: JobStatus }>(
    `select payload->>'coachId' as coach_id, status from jobs
      where type = 'coach_report' and payload->>'runId' = $1`,
    [runId],
  );
