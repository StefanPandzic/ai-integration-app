# Phase 3 Plan: Weekly Reports

Goal: every Monday at 7:00 CT, with nobody touching anything, each coach gets a report on last week's calls and the manager gets a portfolio roll-up. Both are posted to Slack and archived in Google Drive. In this demo, Slack and Drive are mocks; see [Delivery](#delivery-mocked). Scope comes from [UPGRADE_PLAN.md](UPGRADE_PLAN.md#phase-3-weekly-reports-day-3-morning). How the whole app maps to the scenario is in [UPGRADE_PLAN.md](UPGRADE_PLAN.md#scenario-coverage).

## Principles

- **Automation first.** The cron schedule is the product. The UI is for watching runs and for rare manual actions: a backfill, or a rerun after a fix. A run that is missed, stalls or partly fails catches itself up or raises an alert. Nobody has to check the dashboard on Monday.
- **Summaries, never transcripts.** Coach reports read `call_summaries`; the manager report reads coach reports. Prompt size stays bounded at 50+ calls a week.
- **Code counts, the LLM writes.** Call counts, sentiment breakdowns, action-item totals and week-over-week deltas come from SQL. The LLM writes prose and judgments, and never produces numbers.
- **Grounding checks, like Phase 2.** Every call, client or coach the LLM cites must be in its input. Citations that don't resolve get one corrective retry, then the job fails. Names come from the DB, not from the model.
- **Reuse the queue.** Reports are jobs on the existing Postgres worker, so they get backoff, dead-lettering and idempotency.

## What each report must cover (from the scenario)

| Scenario asks for | Where it lives |
| --- | --- |
| Coach report: all of the coach's calls last week, per client | `per_client[]`, one entry per client with calls that week |
| What to focus on next | `per_client[].next_focus` |
| How the client is progressing | `per_client[].progress`, compared against **last week's `next_focus`** and the client's open action items (both given to the LLM as context) |
| A rating for how the coach did | `coach_rating`: a **fixed rubric defined in code** so scores are comparable across coaches and weeks. Each dimension gets a 1–5 score and cites call IDs as evidence |
| Feedback and improvements for the coach | `improvements[]`, each tied to a rubric dimension |
| Anything the coach should pay attention to | `per_client[].watch_outs` and coach-level `attention[]` (for example, follow-ups due this week or a client gone quiet) |
| Manager report: trends across the portfolio | `trends[]`, plus `stats.deltas` versus the previous week |
| Client sentiment | `stats.sentiment` (SQL, overall and per coach) and `sentiment_notes` (LLM, explains the shift) |
| Client concerns | `client_concerns[]`, each citing the client IDs that raised it |
| Marketing or content ideas | `content_ideas[]`, each with the client discussion behind it and the client IDs |
| "etc." | `at_risk_clients[]` and `coach_highlights[]` (one line per coach, with rubric average) |

Rubric dimensions (in `backend/src/schemas/coachReport.ts`, easy to swap once the business sends theirs): **goal clarity**, **accountability** (follows up on last call's action items), **client ownership** (the client leaves with their own commitments), **listening** (talk balance, questions over advice) and **progress toward goals**.

## Report period

- A week runs Monday 00:00 to Sunday 23:59 in `America/Chicago`. Postgres computes the boundaries (`date_trunc('week', now() at time zone 'America/Chicago')`).
- **Scheduled run** and the default for a manual run: the previous full week. A manual run can also take an explicit `periodStart` for backfills.
- A call belongs to the week of its `started_at`, falling back to `created_at`. Only summarized or posted calls count. Calls still under review or failed are listed in `stats.excluded_calls`, and the manager sees that count.
- **Demo data without manual steps:** `POST /api/demo/simulate-week` runs every sample through the normal webhook path, backdated across last week. The mock connector gains an optional `startedAt` offset. With `count` it generates 50+ calls, which also gives a volume test.

## Data model

Migration `003_reports.sql`:

- `reports.status text not null default 'ready'`, constrained to `'ready' | 'empty'`. A coach with no calls gets an `empty` row without an LLM call.
- `reports.drive_file_id` already exists. Add `reports.drive_url text`.
- An index on `jobs ((payload->>'runId'))` for run state.

Report content (jsonb) is stored as `{ stats, ...llmOutput }`. Schemas live in `backend/src/schemas/coachReport.ts` and `managerReport.ts`, within structured-output limits like `callSummary.ts`:

```ts
coachReport = {
  per_client: [{ client_id, progress, next_focus, watch_outs[≤4], evidence_call_ids[≥1] }],
  coach_rating: { dimensions: [{ key: RubricKey, score_1_5, evidence: [{ call_id, note }] }],
                  overall_comment },
  improvements: [{ dimension: RubricKey, suggestion }] (≤5),
  attention: string[] (≤5),
}
coach stats (SQL): calls, clients, sentiment counts, action items by role,
                   overdue action items from previous weeks, excluded_calls

managerReport = {
  trends: string[] (≤6), sentiment_notes: string,
  client_concerns: [{ concern, client_ids[] }] (≤6),
  content_ideas: [{ title, angle, client_ids[] }] (≤5),
  at_risk_clients: [{ client_id, reason }] (≤10),
  coach_highlights: [{ coach_id, note }],
}
manager stats (SQL): sentiment overall and per coach, calls per coach, rubric averages per coach,
                     deltas vs previous week, coaches_without_calls, coach_reports_missing, excluded_calls
```

The overall rating shown in the UI and Slack is the rubric average, computed in code.

## Job flow

New `JobType`s: `weekly_reports`, `coach_report`, `manager_report`.

```
cron Mon 7:00 CT ──┐
startup catch-up ──┼─▶ weekly_reports {runId, periodStart, periodEnd, force}
manual (backfill) ─┘        │ fan-out: one job per coach with an active client
                            ▼
                      coach_report × N
                            │ map: one LLM call per client (this week's summaries,
                            │      last week's next_focus, open action items)
                            │ reduce: one LLM call → rating, improvements, attention
                            │ save → Slack DM to coach → Drive doc
                            ▼
                      manager_report
                            │ gate: every coach_report in the run succeeded or dead,
                            │       otherwise RetryLaterError(30s)
                            │ one LLM call over coach reports + stats
                            ▼
                      save → manager Slack channel → Drive doc
                      run finished partial → alert in ops channel
```

- **Idempotency.**
  - The scheduled run and catch-up use the key `weekly_reports:<periodStart>`, so a double cron fire, a restart or several instances still enqueue once.
  - A manual run uses `weekly_reports:<periodStart>:<runId>` and sets `force: true`.
  - Child jobs use `coach_report:<runId>:<coachId>` and `manager_report:<runId>`.
- **Steps resume like `processCall`.** A stored report is not regenerated, a stored `slack_message_ts` is not posted again, and a stored `drive_file_id` is not uploaded again. `force` clears all three before regenerating.
- **Startup catch-up.** At startup, if it is past Monday 7:00 CT and no `weekly_reports:<lastWeekStart>` job exists, the server enqueues one. A server that was asleep or redeploying on Monday morning still delivers.
- **No silent failures.**
  - The manager gate proceeds once a stalled coach job is dead, and lists that coach under `coach_reports_missing`.
  - Any dead report job, or a run that finishes partial, posts an alert to `SLACK_OPS_CHANNEL_ID`. This uses the alert helper from [Phase 4](UPGRADE_PLAN.md#phase-4-reliability-and-demo-day-3-afternoon); build it here if Phase 3 lands first.

## Delivery (mocked)

Grain, Slack and Google Drive are **mocked** for this demo, so it runs at no cost. Each integration sits behind an interface with a `mock` and a `live` implementation, so a real one drops in later without touching the pipeline. Only the mocks are built now. The live designs are in [INTEGRATIONS.md](INTEGRATIONS.md).

| Output | Slack (mock) | Google Drive (mock) |
| --- | --- | --- |
| Coach report | DM to `coaches.slack_user_id`; if not set, the manager channel | `Weekly reports/<YYYY-MM-DD>/<Coach>` |
| Manager report | Manager channel (`SLACK_MANAGER_CHANNEL_ID`, default `#coaching-managers`) | `Weekly reports/<YYYY-MM-DD>/Manager overview` |
| Ops alert | Ops channel (`SLACK_OPS_CHANNEL_ID`, default `#coaching-ops`) | — |

- **Mock outbox.** Instead of only logging, the mocks write every outgoing Slack message and Drive file to an `integration_outbox` table. The table stores the service, the target (channel or folder path), the title, the payload (Block Kit or HTML) and a fake external ID (Slack `ts` or Drive file ID). The demo can then show exactly what would have been sent and saved, and the existing idempotency rules (`slack_message_ts`, `drive_file_id`) are exercised for real.
- **Drive mock** (`backend/src/services/drive/`): `DriveConnector.saveDocument(folderPath, title, html)` returns `{ fileId, url }`. In mock mode the URL points to the dashboard's outbox view of that file.
- **Slack:** `slackClient.ts` keeps its interface. Its dry-run branch moves to a `SlackConnector` mock that writes to the outbox. `SLACK_MODE=mock|live` replaces "token present means live".
- Slack messages stay short: headline numbers, rating, the top 3 items and a "Full report" link to the Drive (mock) document.

## Backend changes

| File | Change |
| --- | --- |
| `backend/package.json` | `node-cron` (plus types if needed); no Google or Slack SDKs |
| `backend/db/migrations/003_reports.sql` | Columns and index above, plus the `integration_outbox` table |
| `backend/src/db/outboxRepo.ts` | `recordOutbound`, `listOutbox(filters)`, `getOutboxItem` |
| `backend/src/schemas/coachReport.ts`, `managerReport.ts` | Schemas and rubric |
| `backend/src/types/pipeline.ts` | New `JobType`s and `ReportRow` |
| `backend/src/db/reportsRepo.ts` | `getPeriod`, `listSummariesForCoach`, `getPreviousCoachReport`, `listOpenActionItems`, `upsertReport`, `setReportSlackTs`, `setReportDrive`, `listReports`, `getReport`, `getLatestCoachReport`, `getRunState` |
| `backend/src/services/reports/` | `coachReport.ts` (map-reduce + checks), `managerReport.ts`, `runWeeklyReports.ts` (fan-out + gate), `scheduler.ts` (cron + catch-up), `renderReport.ts` (HTML for Drive) |
| `backend/src/services/drive/driveConnector.ts` | `DriveConnector` interface + mock (outbox); `DRIVE_MODE=mock` |
| `backend/src/services/slack/slackClient.ts` | Split into a `SlackConnector` interface + mock (outbox); the current fetch code is kept as the future live implementation, unused |
| `backend/src/services/slack/reportBlocks.ts` | Block Kit for both report types |
| `backend/src/services/grain/grainConnector.ts` | Mock `startedAt` offset for simulate-week |
| `backend/src/services/pipeline/jobHandlers.ts` | Register the 3 handlers |
| `backend/src/routes/reports.ts`, `demo.ts` | API below |
| `backend/src/index.ts` | Mount router; start scheduler with the worker (DB configured only) |
| `backend/.env.example` | `SLACK_MODE`, `DRIVE_MODE` (both `mock` only for now), `SLACK_MANAGER_CHANNEL_ID`, `SLACK_OPS_CHANNEL_ID`, `REPORTS_CRON` (default `0 7 * * 1`), `REPORTS_CRON_ENABLED` |

## API

```
GET  /api/reports?type=&coachId=&periodStart=   list (newest first, no content)
GET  /api/reports/:id                            full report incl. stats and drive_url
GET  /api/reports/runs?limit=                    recent runs: period, trigger (cron|catch-up|manual), state, job counts
POST /api/reports/run  { periodStart? }          manual backfill/rerun → 202 { runId, periodStart, periodEnd }
POST /api/demo/simulate-week  { count? }         backdated mock calls through the webhook path
GET  /api/outbox?service=slack|drive&target=     what the mocks "sent" and "saved" (newest first)
GET  /api/outbox/:id                             one message or document, full payload
```

`GET /api/coaches/:id` also returns `latestReport` (id, period, rubric average).

## Frontend changes

- `src/features/reports/` with `types/`, `services/reportsApi.ts` (`listReports`, `getReport`, `listReportRuns`, `runReports`; adds a `'Report'` tag), `hooks/`, `components/` and `index.ts`.
  - `useReportRuns` polls at `LIVE_POLL_MS` only while a run is in progress, then invalidates `Report`.
- **`ReportsPage`**, a monitoring view first:
  - Next scheduled run time and last run state (ok, partial or failed, with the missing coaches).
  - The latest manager report, then that week's coach reports, plus a period picker.
  - **Rerun week** sits behind a confirm dialog, as an admin action rather than the main button.
- **`ReportDetailPage`** at `/reports/:id`: rubric table with evidence links to `/calls/:id`, per-client cards, Drive link.
- **`CoachDetailPage`**: the "Weekly report" panel shows the latest report and the rubric trend over recent weeks.
- **Top bar:** next to **Simulate call**, add **Simulate week** (demo mode only).
- **`OutboxPage`** at `/outbox` (new `features/outbox/`): two tabs.
  - **Slack:** messages grouped by channel or DM, with Block Kit rendered approximately (header, sections, fields).
  - **Drive:** a folder tree of saved documents, with the HTML shown in a sandboxed `iframe srcDoc`.
  - Call detail and report detail link to their outbox entries.
- **`AppShell`:** remove `soon: true` from Reports.

## Build order

1. Migration, schemas and rubric, `reportsRepo` with the period SQL, and simulate-week. Simulate-week comes first so there is data to work with.
2. `coachReport.ts`, plus `npm run reports:check -- <coachId>` to print a report without saving it.
3. `managerReport.ts`, the job handlers and the fan-out/gate; Slack blocks; the ops alert.
4. Outbox table and repo; Slack and Drive mock connectors (the per-call Slack post moves onto the outbox too); `renderReport.ts`, wired into both report jobs.
5. Routes, the scheduler and catch-up. End-to-end test: simulate week, set `REPORTS_CRON` to every minute, and confirm a run starts on its own, retries a forced failure and alerts.
6. Frontend: feature folder, pages, coach panel, Simulate week, Outbox page.
7. Update `ARCHITECTURE.md`, `CLAUDE.md` and `UPGRADE_PLAN.md`.

Type-check after each step (`cd backend && npm run type-check`, `npm run build`).

## Risks and cuts

- **Volume:** at 50+ calls across about 5 coaches, a run is roughly 5 × (clients + 1) + 1 LLM calls. That's fine with Claude. `deepseek-r1` on Ollama is slow, so for local demos collapse map-reduce into one call per coach when a coach has ≤3 clients.
- **Real data:** the business's summary format and rubric are unknown (open question). Both live in one schema file each, so swapping them is a contained change.
- **Cut first if short on time:** the rubric trend chart, the period picker, `reports:check`. **Never cut:** the cron, catch-up, idempotency keys and the failure alert, because those make it automatic.
