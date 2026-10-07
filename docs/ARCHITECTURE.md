# Architecture: Coaching Call Intelligence

**Last updated:** October 7, 2026

The app ingests coaching calls (Grain, or mock samples in demo mode), summarizes each call with an LLM, posts the summary to the client's Slack channel, and shows calls, clients and coaches in a dashboard. Every Monday at 7:00 CT it builds a weekly report per coach and a manager roll-up, posts them to Slack and archives them in Google Drive. Grain, Slack and Drive are mocked in the demo; Slack and Drive write to an outbox shown in the dashboard (see [INTEGRATIONS.md](INTEGRATIONS.md)).

## System overview

```
Grain webhook ─▶ POST /webhooks/grain ─┐
Simulate call/week ─▶ POST /api/demo/... ┼─▶ job: ingest_grain_recording ─▶ calls row (unique grain_recording_id)
POST /api/calls (other sources) ───────┘                                      │
                                                                              ▼
                                       job: process_call ─▶ match ─▶ summarize ─▶ Slack
                                                              │
                                                              └─▶ no match: status needs_review
                                                                  (assigned by hand in /review)

cron Mon 7:00 CT ─┐
startup catch-up ─┼─▶ job: weekly_reports ─▶ coach_report × N ─▶ save → Drive → Slack DM
manual rerun ─────┘                        └▶ manager_report (gated on coach jobs) ─▶ save → Drive → manager channel
                                                                    partial run / dead job ─▶ ops alert

Slack + Drive (mock) ─▶ integration_outbox ─▶ /api/outbox ─▶ Outbox page

React dashboard ◀── RTK Query (polling) ── /api/calls, /clients, /coaches, /reports, /outbox, /demo
```

Every entry point stores work and returns right away. The Postgres job worker does the slow parts.

## Backend (`backend/src/`)

| Area | Files | Role |
| --- | --- | --- |
| Entry | `index.ts` | Express app, routers, `/health`; starts the job worker and the report scheduler when `DATABASE_URL` is set |
| Routes | `routes/calls.ts`, `directory.ts`, `demo.ts`, `webhooks.ts`, `reports.ts`, `outbox.ts` | HTTP API (below); shared helpers in `routes/helpers.ts` |
| Ingest | `services/pipeline/ingest.ts` | `acceptGrainRecording`, `ingestCall`, `assignCall`; all idempotent |
| Jobs | `services/pipeline/jobHandlers.ts`, `services/queue/worker.ts`, `db/jobsRepo.ts` | One job at a time, `FOR UPDATE SKIP LOCKED`, exponential backoff with jitter, dead-letter. `RetryLaterError(…, countsAsAttempt=false)` waits without using up attempts; `onDead` hook raises ops alerts |
| Pipeline | `services/pipeline/processCall.ts`, `matching.ts`, `summarizeCall.ts` | Match → summarize → Slack. Each step is persisted, so a retry skips finished steps |
| Reports | `services/reports/` | `coachReport.ts`, `managerReport.ts` (generation + grounding checks), `runWeeklyReports.ts` (fan-out, gate, delivery), `scheduler.ts` (cron + catch-up), `renderReport.ts` (Drive HTML), `grounding.ts` (refs, checked generation, talk share) |
| LLM | `services/llm/` | `generateStructured()`: Claude (structured outputs) with an Ollama fallback; zod-validated, one repair retry |
| Grain | `services/grain/` | Connector (`GRAIN_MODE=mock` serves `sampleCalls.ts`; mock IDs can carry a backdated `startedAt`), webhook signature check |
| Slack | `services/slack/` | `SlackConnector` (`SLACK_MODE=mock` writes to the outbox; `live` posts and honors `Retry-After`), Block Kit builders for summaries, reports and ops alerts |
| Drive | `services/drive/driveConnector.ts` | `DriveConnector.saveDocument(folder, title, html, key)`; mock only (`DRIVE_MODE=mock`), idempotent per key |
| Alerts | `services/alerts/opsAlerts.ts` | Ops channel alerts (`SLACK_OPS_CHANNEL_ID`): dead report jobs, partial runs |
| Config | `config/aiModels.ts`, `config/integrations.ts` | LLM settings; connector modes, channels, dashboard URL, report cron |
| Data | `db/*Repo.ts`, `db/migrations/*.sql` | `coaches`, `clients`, `calls`, `call_summaries`, `reports`, `jobs`, `integration_outbox` |

### Call statuses

`received` → `summarized` → `posted`. If the call can't be matched it becomes `needs_review`. Assigning a client sets it back to `received` and the pipeline runs again. When the job is dead-lettered the call becomes `failed`.

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
| GET | `/api/calls/:id` | `{ call, summary, client, coach, job, outbox: { slack } }` |
| POST | `/api/calls` | Ingest a call from another source (`source: 'browser'`) |
| POST | `/api/calls/:id/assign` | Resolve a review-queue (or failed) call |
| GET | `/api/clients?coachId=` | Clients with call count, last call date and latest sentiment |
| GET | `/api/clients/:id` | `{ client, calls, summaries }` (summaries newest first) |
| GET | `/api/coaches` | Coaches with client count, calls total and calls in the last 7 days |
| GET | `/api/coaches/:id` | `{ coach, clients, calls, latestReport, reportTrend }` |
| GET | `/api/reports?type=&coachId=&periodStart=` | Report list, newest week first (no content) |
| GET | `/api/reports/:id` | `{ report, outbox: { slack, drive } }` with full content and stats |
| GET | `/api/reports/runs?limit=` | Recent runs (period, trigger, state `running`/`ok`/`partial`/`failed`, job counts, missing coaches) and the schedule (next run) |
| POST | `/api/reports/run` | `{ periodStart? }` manual backfill/rerun (forces regeneration) → 202 `{ runId, periodStart, periodEnd }` |
| GET | `/api/outbox?service=slack\|drive&target=` | What the mock connectors sent/saved, newest first (no Drive HTML) |
| GET | `/api/outbox/:id` | One message or document with its full payload |
| GET | `/api/demo/samples` | Grain/Slack/Drive modes, mock samples |
| POST | `/api/demo/simulate-call` | Sends a mock sample through the webhook path (`GRAIN_MODE=mock` only) |
| POST | `/api/demo/simulate-week` | `{ count? }` samples backdated across last week's workdays, through the webhook path |
| POST | `/webhooks/grain` | Signature check, then enqueue, then 200. Duplicates are acknowledged and ignored |

Coaches and clients are read-only and come from `npm run db:seed`.

## Frontend (`src/`)

```
main.tsx      Redux Provider → PersistGate → ChakraProvider(theme) → BrowserRouter → App
App.tsx       AppShell wiring (simulate call/week, review badge, color mode) + routes
pages/        One component per route; pages call hooks and pass props down
features/
  calls/      callsApi (RTK Query, incl. demo endpoints), useCallDetail, useAssignCall, table/detail/summary/review components
  clients/    clientsApi, ClientsTable, ClientInsights
  coaches/    coachesApi, CoachCards
  reports/    reportsApi, useReportRuns, useRunReports, run status, rerun dialog, coach/manager report views, rubric table, coach panel
  outbox/     outboxApi, SlackOutbox (Block Kit preview), DriveOutbox (folder tree + sandboxed preview)
  layout/     AppShell (sidebar, drawer on mobile, top bar), SimulateCallMenu, SimulateWeekMenu
  logging/    createLogger('<feature>')
components/   Shared presentational primitives (Panel, PageHeader, StatCard, EmptyState, QueryState, BackLink)
store/        api.ts (RTK Query base), slices/appSlice.ts (color mode), persisted with redux-persist
theme.ts      Chakra theme (brand indigo scale, Inter)
```

| Route | Page |
| --- | --- |
| `/calls` | Calls table, with filters stored in the URL (`?status=&coachId=&clientId=`) |
| `/calls/:id` | Summary and transcript tabs, details, pipeline state (with a link to the Slack message in the outbox), assign picker for review calls |
| `/review` | `needs_review` queue with the assign picker |
| `/clients`, `/clients/:id` | Client list; profile with stats, sentiment over time, latest commitments, recent risks, calls |
| `/coaches`, `/coaches/:id` | Coach cards; roster, recent calls, latest weekly report and rubric trend |
| `/reports` | Next scheduled run and last run state, then the selected week's manager report and coach reports (`?period=`); "Rerun week" behind a confirm dialog |
| `/reports/:id` | Coach report (per-client cards, rubric table with evidence links to calls) or manager report; links to its Drive document and Slack message |
| `/outbox` | Slack tab (messages per channel/DM, Block Kit rendered) and Drive tab (folder tree, HTML preview); `?tab=&item=&channel=` |

### Data fetching

- Server data lives only in the RTK Query cache (`store/api.ts`). Each feature injects its own endpoints, and the cache is never persisted.
- List pages poll every `LIVE_POLL_MS` (3 s), because calls change state in the background. `useCallDetail` polls only while the call is still being processed; `useReportRuns` polls only while a run is in progress and invalidates `Report`, `Coach` and `Outbox` whenever the run makes progress.
- Mutations (`assignCall`, `simulateCall`, `simulateWeek`) invalidate the `Call`, `Client` and `Coach` tags; `runReports` invalidates `ReportRun`.
