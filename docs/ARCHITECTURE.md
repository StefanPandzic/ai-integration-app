# Architecture: Coaching Call Intelligence

**Last updated:** October 7, 2026

The app ingests coaching calls (Grain, or mock samples in demo mode), summarizes each call with an LLM, posts the summary to the client's Slack channel, archives it in Google Drive, and shows calls, clients and coaches in a dashboard. A nightly reconcile recovers missed webhooks, and every failure or unmatched call raises an ops alert (see [SOP.md](SOP.md)). Every Monday at 7:00 CT it builds a weekly report per coach and a manager roll-up, posts them to Slack and archives them in Google Drive. Grain, Slack and Drive are mocked in the demo; Slack and Drive write to an outbox shown in the dashboard (see [INTEGRATIONS.md](INTEGRATIONS.md)).

## System overview

```
Grain webhook ─▶ POST /webhooks/grain ─┐
Simulate call/week ─▶ mock Grain ───────┼─▶ job: ingest_grain_recording ─▶ calls row (unique grain_recording_id)
nightly reconcile_grain (lists Grain) ─┤                                      │
POST /api/calls (other sources) ───────┘                                      ▼
                                       job: process_call ─▶ match ─▶ summarize ─▶ Slack ─▶ Drive
                                                              │
                                                              └─▶ no match: status needs_review + ops alert
                                                                  (assigned by hand in /review)

any job dead-lettered ─▶ ops alert ─▶ Retry (POST /api/jobs/:id/retry)

cron Mon 7:00 CT ─┐
startup catch-up ─┼─▶ job: weekly_reports ─▶ coach_report × N ─▶ save → Drive → Slack DM
manual rerun ─────┘                        └▶ manager_report (gated on coach jobs) ─▶ save → Drive → manager channel
                                                                    partial run / dead job ─▶ ops alert

Slack + Drive (mock) ─▶ integration_outbox ─▶ /api/outbox ─▶ Outbox page

React dashboard ◀── RTK Query (polling) ── /api/calls, /clients, /coaches, /reports, /outbox, /pipeline, /jobs, /demo
```

Every entry point stores work and returns right away. The Postgres job worker does the slow parts.

## Backend (`backend/src/`)

| Area | Files | Role |
| --- | --- | --- |
| Entry | `index.ts` | Express app, routers, `/health`; starts the job worker and the scheduler when `DATABASE_URL` is set |
| Routes | `routes/calls.ts`, `directory.ts`, `demo.ts`, `webhooks.ts`, `reports.ts`, `outbox.ts`, `pipeline.ts` | HTTP API (below); shared helpers in `routes/helpers.ts` |
| Ingest | `services/pipeline/ingest.ts` | `acceptGrainRecording`, `ingestCall`, `assignCall`; all idempotent |
| Jobs | `services/pipeline/jobHandlers.ts`, `services/queue/worker.ts`, `db/jobsRepo.ts` | One job at a time, `FOR UPDATE SKIP LOCKED`, exponential backoff with jitter, dead-letter. `RetryLaterError(…, countsAsAttempt=false)` waits without using up attempts; `onDead` hook raises ops alerts |
| Pipeline | `services/pipeline/processCall.ts`, `matching.ts`, `summarizeCall.ts`, `reconcile.ts`, `demoFaults.ts` | Match → summarize → Slack → Drive. Each step is persisted and skipped when done, so a retry resumes where it stopped. `reconcile_grain` re-feeds Grain's recent recordings through the idempotent ingest |
| Scheduler | `services/scheduler/` | node-cron in America/Chicago: weekly reports (`REPORTS_CRON`) and reconcile (`RECONCILE_CRON`), each with a startup catch-up |
| Rate limits | `services/rateLimit.ts` | In-process token buckets: Gemini, one bucket per model (`LLM_SETTINGS.geminiRequestsPerMinute`, `geminiLiteRequestsPerMinute`), Slack (1 msg/s per channel). Long waits become `RetryLaterError` so the worker isn't blocked |
| Logging | `lib/logger.ts` | `createLogger(scope)`; the worker wraps each job in `withLogContext({ jobId, callId, runId })` so every line carries them. `LOG_FORMAT=json` for one object per line |
| Reports | `services/reports/` | `coachReport.ts`, `managerReport.ts` (generation + grounding checks), `runWeeklyReports.ts` (fan-out, gate, delivery), `renderReport.ts` (Drive HTML), `grounding.ts` (refs, checked generation, talk share) |
| LLM | `services/llm/` | `generateStructured()`: Gemini Flash (structured outputs), falling back to Gemini Flash Lite then Ollama (`LLM_SETTINGS.fallbacks`); zod-validated, one repair retry |
| Grain | `services/grain/` | Connector: `fetchRecording`, `listRecordings(since)`. `GRAIN_MODE=mock` serves `sampleCalls.ts` (mock IDs can carry a backdated `startedAt`); `mockGrain.ts` records every simulated recording in `mock_grain_recordings` and can drop its webhook (demo). Webhook signature check |
| Slack | `services/slack/` | `SlackConnector` (`SLACK_MODE=mock` writes to the outbox; `live` posts and honors `Retry-After`), Block Kit builders for summaries, reports and ops alerts |
| Drive | `services/drive/driveConnector.ts`, `renderCall.ts` | `DriveConnector.saveDocument(folder, title, html, key)`; mock only (`DRIVE_MODE=mock`), idempotent per key. Call summaries go to `Calls/<Client>/<YYYY-MM>` |
| Alerts | `services/alerts/opsAlerts.ts` | Ops channel alerts (`SLACK_OPS_CHANNEL_ID`), each with an idempotency key: every dead job, review-queue calls, partial report runs, recovered recordings |
| Live updates | `services/live/liveEvents.ts`, `routes/events.ts`, migration `005_live_updates.sql` | Statement triggers on every dashboard table `pg_notify('table_changes', <table>)` (any process, CLI scripts too). One dedicated `LISTEN` connection maps tables to RTK Query tags, batches them for 150 ms and pushes them over SSE; `publishChange()` covers in-memory state (demo switches). Reconnects with backoff; while down, `/api/events` returns 503 |
| Config | `config/aiModels.ts`, `config/integrations.ts` | LLM settings and the Gemini rate limit; connector modes, channels, dashboard URL, crons, Slack rate limit |
| Data | `db/*Repo.ts`, `db/migrations/*.sql` | `coaches`, `clients`, `calls`, `call_summaries`, `reports`, `jobs`, `integration_outbox`, `mock_grain_recordings` |

### Call statuses

`received` → `summarized` → `posted` (then archived to Drive; `drive_file_id` is set). If the call can't be matched it becomes `needs_review`. Assigning a client sets it back to `received` and the pipeline runs again. When the job is dead-lettered the call becomes `failed`; Retry puts it back to the status of its last finished step.

### Reliability

Detailed design: [PHASE4_PLAN.md](PHASE4_PLAN.md). Runbook: [SOP.md](SOP.md).

- **Retry:** `POST /api/jobs/:id/retry` resets a dead job (`attempts = 0`). Every step is persisted, so it resumes rather than restarts.
- **Ops alerts:** the worker's `onDead` hook alerts for every dead job. `processCall` alerts for review-queue calls, and the reconcile for recovered recordings. Keys (`alert:dead:<jobId>:<claim time>`, `alert:review:<callId>`, …) stop repeats.
- **Reconcile:** `reconcile_grain` lists recordings from the last `RECONCILE_LOOKBACK_HOURS` (48) and calls `acceptGrainRecording` for each; the `grain:<id>` key turns known ones into no-ops. Scheduled runs use `reconcile:<date>`, startup catches up if none ran in 24 h, and the Pipeline page can run one by hand.
- **Demo switches** (mock Grain only, in memory): `drop-next-webhook` records the next simulated recording in mock Grain without sending its webhook; `fail-next-call` makes the next `process_call` fail permanently once.
- **Eval:** `npm run eval` runs `summarizeCall` on the 5 samples against the answer key in `sampleCalls.ts` (`expectedActionItems`): schema validity, recall, owner accuracy and made-up items.

### Matching rules (deterministic)

1. Client: a participant email matches exactly one client. Otherwise a title keyword matches exactly one client.
2. Coach: the single coach on the call (by email). Otherwise the client's assigned coach.
3. Anything ambiguous goes to `needs_review`. Nothing is ever posted to a guessed channel.

### Weekly reports

Detailed design: [PHASE3_PLAN.md](PHASE3_PLAN.md).

- **Period:** Monday to Sunday in `America/Chicago`, computed in Postgres. A call belongs to the week of `started_at` (else `created_at`). Only `summarized`/`posted` calls count; the rest are reported as `excluded_calls`.
- **Code counts, the LLM writes.** Calls, sentiment, action items, coach talk share, rubric averages and week-over-week deltas are computed in SQL/code and stored as `content.stats`. The LLM writes prose and judgments only.
- **Grounding:** the model sees short refs (`call-3`, `client-1`, `coach-2`), never IDs. Code maps them back; an unknown ref, a missing client section or a missing rubric dimension gets one corrective retry, then the job fails. Names come from the DB.
- **Coach report:** map (one LLM call per client: this week's summaries, last week's `next_focus`, action items carried in) then reduce (rubric rating, improvements, attention). With ≤3 clients it is one call. A coach with no calls gets an `empty` report without an LLM call. The rubric is fixed in `schemas/coachReport.ts`.
- **Manager report:** one LLM call over the week's coach reports plus stats. Waits (without using attempts) until every coach job succeeded or is dead; after 2 hours it proceeds anyway and lists missing coaches.
- **Idempotency:** scheduled and catch-up runs use `weekly_reports:<periodStart>`; manual runs add the run ID and set `force`. Child jobs use `coach_report:<runId>:<coachId>` and `manager_report:<runId>`. A stored report, Drive file or Slack `ts` is never redone; `force` replaces reports made before the run.
- **Delivery:** Drive first (`Weekly reports/<periodStart>/<Coach | Manager overview>`), then Slack with a link to it: coach DM (`coaches.slack_user_id`, else the manager channel), manager channel for the roll-up.

### HTTP API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/calls?status=&clientId=&coachId=&limit=&offset=` | List with client/coach names, summary sentiment, action-item count and latest job state |
| GET | `/api/calls/:id` | `{ call, summary, client, coach, job, outbox: { slack, drive } }` |
| POST | `/api/calls` | Ingest a call from another source (`source: 'browser'`) |
| POST | `/api/calls/:id/assign` | Resolve a review-queue (or failed) call: `{ clientId }`, or `{ newClient: { name, email, coachId, slackChannelId? } }` to create the client too (its email matches future calls). The channel is checked first and the bot joins it if public; when it is omitted, the default Slack channel is used |
| GET | `/api/clients?coachId=` | Clients with call count, last call date and latest sentiment |
| GET | `/api/clients/:id` | `{ client, calls, summaries }` (summaries newest first) |
| PATCH | `/api/clients/:id/slack-channel` | `{ slackChannelId }`: checks the channel (the bot joins it if public), then saves it; returns `{ channel }` |
| GET | `/api/slack/channels?refresh=1` | `{ mode, channels: [{ id, name, is_private, is_member }] }` for the channel picker; cached 5 minutes unless `refresh=1`; mock mode returns fake channels |
| GET | `/api/coaches` | Coaches with client count, calls total and calls in the last 7 days |
| GET | `/api/coaches/:id` | `{ coach, clients, calls, latestReport, reportTrend }` |
| GET | `/api/reports?type=&coachId=&periodStart=` | Report list, newest week first (no content) |
| GET | `/api/reports/:id` | `{ report, outbox: { slack, drive } }` with full content and stats |
| GET | `/api/reports/runs?limit=` | Recent runs (period, trigger, state `running`/`ok`/`partial`/`failed`, job counts, missing coaches) and the schedule (next run) |
| POST | `/api/reports/run` | `{ periodStart? }` manual backfill/rerun (forces regeneration) → 202 `{ runId, periodStart, periodEnd }` |
| GET | `/api/outbox?service=slack\|drive&target=` | What the mock connectors sent/saved, newest first (no Drive HTML) |
| GET | `/api/outbox/:id` | One message or document with its full payload |
| GET | `/api/pipeline/health` | Queue counts (pending, ready, running, dead), oldest ready job age, last hour throughput, last reconcile, last report run, next cron runs |
| POST | `/api/pipeline/reconcile` | Manual Grain reconcile → 202 `{ jobId }` |
| GET | `/api/jobs?status=&type=&limit=` | Job feed, most recently changed first, with call title, coach and reconcile result |
| POST | `/api/jobs/:id/retry` | Dead job → pending; a failed call returns to its last finished step. 404 / 409 if not dead |
| GET | `/api/demo/samples` | Grain/Slack/Drive modes, demo switches, mock samples |
| POST | `/api/demo/simulate-call` | Records a mock sample in mock Grain and sends its webhook unless dropped (`GRAIN_MODE=mock` only) |
| POST | `/api/demo/drop-next-webhook`, `/api/demo/fail-next-call` | `{ enabled }` demo failure switches |
| POST | `/api/demo/simulate-week` | `{ count? }` samples backdated across last week's workdays, through the webhook path |
| GET | `/api/events` | Server-Sent Events: `event: invalidate` with `{ tags }` to refetch, `: ping` every 25 s. 503 while the database listener is down |
| POST | `/webhooks/grain` | Signature check, then enqueue, then 200. Duplicates are acknowledged and ignored |
| GET | `/health` | DB state, queue depth, oldest ready job, last reconcile and report run, next runs; 503 when the DB is unreachable |

Coaches and clients come from `npm run db:seed`; clients are also added from the review queue. Only a client's Slack channel can be edited.

## Frontend (`src/`)

```
main.tsx      Redux Provider → PersistGate → ChakraProvider(theme) → BrowserRouter → App
App.tsx       AppShell wiring (simulate call/week, demo switches, review and dead-job badges, color mode) + routes
pages/        One component per route; pages call hooks and pass props down
features/
  calls/      callsApi (RTK Query, incl. demo endpoints), useCallDetail, useAssignCall, table/detail/summary/review components
  clients/    clientsApi, ClientsTable, ClientInsights
  coaches/    coachesApi, CoachCards
  reports/    reportsApi, useReportRuns, useRunReports, run status, rerun dialog, coach/manager report views, rubric table, coach panel
  outbox/     outboxApi, SlackOutbox (Block Kit preview), DriveOutbox (folder tree + sandboxed preview)
  pipeline/   pipelineApi, useRetryJob, useReconcileNow, QueueStats, JobFeedTable, FailuresList
  layout/     AppShell (sidebar, drawer on mobile, top bar), SimulateCallMenu, SimulateWeekMenu
  logging/    createLogger('<feature>')
components/   Shared presentational primitives (Panel, PageHeader, StatCard, EmptyState, QueryState, BackLink)
store/        api.ts (RTK Query base), slices/appSlice.ts (color mode), persisted with redux-persist
theme.ts      Chakra theme (brand indigo scale, Inter)
```

| Route | Page |
| --- | --- |
| `/calls` | Calls table, with filters stored in the URL (`?status=&coachId=&clientId=`) |
| `/calls/:id` | Summary and transcript tabs, details, pipeline state (links to the Slack message and Drive copy in the outbox; Retry when the job is dead), assign picker for review calls |
| `/review` | `needs_review` queue with the assign picker; `?call=` highlights one (ops alert link) |
| `/clients`, `/clients/:id` | Client list; profile with stats, sentiment over time, latest commitments, recent risks, calls |
| `/coaches`, `/coaches/:id` | Coach cards; roster, recent calls, latest weekly report and rubric trend |
| `/reports` | Next scheduled run and last run state, then the selected week's manager report and coach reports (`?period=`); "Rerun week" behind a confirm dialog |
| `/reports/:id` | Coach report (per-client cards, rubric table with evidence links to calls) or manager report; links to its Drive document and Slack message |
| `/outbox` | Slack tab (messages per channel/DM, Block Kit rendered) and Drive tab (folder tree, HTML preview); `?tab=&item=&channel=` |
| `/pipeline` | Queue stats; Live feed and Failures (dead jobs with Retry) tabs (`?tab=`); Reconcile now |

### Data fetching

- Server data lives only in the RTK Query cache (`store/api.ts`). Each feature injects its own endpoints, and the cache is never persisted.
- Live updates: `App` runs `useLiveUpdates()` (`features/live`), which keeps an `EventSource` on `/api/events` and calls `api.util.invalidateTags(tags)` for each event, so pages refetch as soon as the pipeline writes. After a gap it invalidates every tag once. The connection state is in the `live` slice (not persisted).
- Polling is the fallback: list pages poll at `useLivePollInterval()`, which is `LIVE_POLL_MS` (3 s) while the stream is down and `LIVE_SAFETY_POLL_MS` (60 s) while it is open. `useCallDetail` polls only while the call is still being processed; `useReportRuns` polls only while a run is in progress and invalidates `Report`, `Coach` and `Outbox` whenever the run makes progress.
- Mutations (`assignCall`, `simulateCall`, `simulateWeek`) invalidate the `Call`, `Client` and `Coach` tags; `runReports` invalidates `ReportRun`; `retryJob` and `reconcileNow` invalidate `Job`, `Pipeline` and the calls list.
- `App` polls `/api/pipeline/health` for the sidebar's dead-job badge; `useDemoInfo` polls demo info only while a demo switch is armed.
