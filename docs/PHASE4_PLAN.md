# Phase 4 Plan: Reliability and Demo

**Status:** done. See [As built](#as-built-differences-from-the-plan) for where the build differs from this plan.

Goal: the system runs without anyone watching it. Missed webhooks are recovered on their own. Every failure and every unmatched call reaches a person in Slack, and that person can fix it with one click. A reviewer can see the system's health on one page, run an eval, and set it up from the README. Scope comes from [UPGRADE_PLAN.md](UPGRADE_PLAN.md#phase-4-reliability-and-demo-day-3-afternoon). Grain, Slack and Drive stay mocked ([INTEGRATIONS.md](INTEGRATIONS.md)).

## Principles

- **Problems come to people.** Every dead job, review-queue call and partial report run posts an ops alert (mock outbox, `SLACK_OPS_CHANNEL_ID`) that links to the screen where it gets fixed. Nobody has to check the dashboard.
- **Recover, don't babysit.** The nightly reconcile catches missed webhooks. The existing `grain:<id>` idempotency key makes it safe to run as often as needed.
- **Every step resumes.** `processCall` becomes match → summarize → Slack → Drive. Each step stores its result and is skipped on retry, so Retry is always safe.
- **One correlation ID.** Every log line written while a job runs carries `jobId` and, where there is one, `callId` or `runId`. Nothing has to pass it around by hand.

## 1. Retry button (any dead job)

- `jobsRepo.retryJob(id)`: sets a `dead` job back to `pending` with `attempts = 0`, `run_at = now()` and `last_error` kept until it runs. Any other status returns 409.
- When the job has a `call_id` and the call is `failed`, the call goes back to `received`. Report jobs need nothing extra: the gate and the resume logic already handle a coach job that comes back to life. The manager job re-waits through `RetryLaterError`.
- `POST /api/jobs/:id/retry` → 202.
- UI: a **Retry** button on Call detail when the latest job is dead, and on every row of the Failures view. Assign stays as it is for review calls.

## 2. Ops alerts

`opsAlerts.ts` gains an optional idempotency `key` (passed to the outbox), so a retried job or a re-run reconcile never double-alerts.

| Alert | Trigger | Link | Key |
| --- | --- | --- | --- |
| Call failed | `process_call` / `ingest_grain_recording` dead (worker `onDead`) | `/calls/:id` (or `/pipeline?tab=failures`) | `alert:dead:<jobId>:<attempt count>` |
| Report job failed | existing, unchanged | `/reports` | as above |
| Call needs review | `markNeedsReview` in `processCall` | `/review?call=<id>` (assign there) | `alert:review:<callId>` |
| Partial report run | existing, unchanged | `/reports` | existing |
| Missed recordings recovered | reconcile found ≥ 1 | `/pipeline` | `alert:reconcile:<jobId>` |

`ReviewPage` reads `?call=` and scrolls to and highlights that call.

## 3. Nightly reconcile

- **Mock Grain gets memory.** Migration `004_reliability.sql` adds `mock_grain_recordings(recording_id pk, sample_id, started_at, webhook_dropped bool, created_at)`. Every simulated recording (call or week) is written there first, the way Grain itself knows about every recording. `GrainConnector` gains `listRecordings(since): Promise<{ id, startedAt }[]>`. The mock reads the table; live throws `NonRetryableError`, like `fetchRecording`.
- **Drop next webhook (demo).** `POST /api/demo/drop-next-webhook { enabled }` sets an in-memory flag, reported by `GET /api/demo/samples`. The next simulated call is recorded in Grain, with `webhook_dropped = true`, but is not enqueued. The flag then clears.
- **Job `reconcile_grain`** `{ since }`: lists recordings from the last `RECONCILE_LOOKBACK_HOURS` (default 48) and calls `acceptGrainRecording` for each one. Duplicates are no-ops, and it counts the ones that were created. It logs and alerts on any it recovered.
- **Schedule.** `RECONCILE_CRON` defaults to `0 2 * * *` (America/Chicago). The idempotency key is `reconcile:<YYYY-MM-DD>`. At startup a catch-up runs the reconcile if none has succeeded in 24 h. A manual **Reconcile now** on the Pipeline page uses `reconcile:manual:<uuid>`. The scheduler moves into a shared `services/scheduler/` module that starts both crons.
- Demo script: toggle **Drop next webhook** → Simulate call → the call is not in Calls → **Reconcile now** → it appears, and an alert says one recording was recovered.

## 4. Drive archive per call

- Migration: `calls.drive_file_id`, `calls.drive_url`.
- `processCall` is restructured so that each step skips on its own. Today it returns early once `slack_message_ts` is set. The new order is match → summary → Slack (skipped if `ts` is set) → Drive (skipped if `drive_file_id` is set).
- `renderCallSummaryHtml` (new, in `services/drive/renderCall.ts`, reusing `renderReport.ts` styles). The folder is `Calls/<Client>/<YYYY-MM>`, the title is `<YYYY-MM-DD> <call title>`, and the key is `call:<callId>`.
- Call status stays `posted`. Call detail shows a "Drive" link next to the Slack outbox link. `GET /api/calls/:id` returns `outbox.drive`.

## 5. Rate limits

- `services/rateLimit.ts`: an in-process token bucket per key, `acquire(key, maxWaitMs)`. If the wait would exceed `maxWaitMs`, it throws `RetryLaterError(wait)` so the queue reschedules the job instead of blocking the worker.
- **Claude:** `LLM_SETTINGS.claudeRequestsPerMinute` (default 50; model config stays in `aiModels.ts`, not `.env`), checked in `claudeProvider.ts` before each request. Ollama has no limit.
- **Slack:** 1 message per second per channel (Slack's `chat.postMessage` tier), applied in `postMessage()` so the mock exercises it as well. Live 429 handling stays as it is.
- Values live in `config/integrations.ts` (`SLACK_RATE_LIMIT`) and `config/aiModels.ts`.

## 6. Structured logs (whole backend)

- `backend/src/lib/logger.ts`: `createLogger(scope)` with `debug/info/warn/error(message, fields?)`. Context comes from `AsyncLocalStorage` through `withLogContext({ jobId, callId, runId }, fn)`.
- The worker wraps each job in `withLogContext`. Ingest and webhook routes add `recordingId`.
- `LOG_FORMAT=pretty` (default; it keeps today's emoji style, prefixed by `[call 1a2b3c4d]`) or `json` (one object per line: `ts, level, scope, msg, ...context, ...fields`). `LOG_LEVEL` defaults to `info`.
- All ~50 `console.*` calls in `backend/src` are replaced. CLI scripts (`migrate`, `seed`, `reportsCheck`, `llmCheck`, eval) keep plain stdout for their own output.

## 7. `npm run eval`

- `SampleCall` gains `expectedActionItems: { owner, keywords[] }[]`. Annotate all 5 samples.
- `backend/src/scripts/eval.ts` runs `summarizeCall` on each sample through the configured provider. It uses in-memory coach and client rows, so it needs no DB and writes nothing.
- Per sample:
  - **Schema valid:** the zod parse passes.
  - **Owner accuracy:** every owner is a participant, and the matched expected items have the right owner.
  - **Recall:** expected items found, judged by keyword overlap.
  - **Made-up items:** items that match no expected item and whose content words are not grounded in the owner's own transcript lines.
- Output: a table per sample and totals. `--json <path>` writes the raw results. The exit code is 1 when there is a schema failure, a made-up item, or owner accuracy below 100%. `-- ollama` forces the provider, as in `llm:check`.

## 8. Pipeline page and `/health`

**Backend**
- `jobsRepo`: `getQueueHealth()` returns counts by status, the oldest pending job's age, jobs done and failed in the last hour, and the last reconcile. `listJobs({ status?, type?, limit })` returns the job feed.
- `GET /api/pipeline/health`, `GET /api/jobs?status=&type=&limit=`, `POST /api/jobs/:id/retry`, `POST /api/pipeline/reconcile`.
- `/health` adds `queue: { depth, running, dead, oldestPendingAgeSeconds }`, `lastReportRun` (from `listRuns(1)`), `lastReconcile` and the next cron times. It returns 503 when the DB is unreachable.

**Frontend:** new `features/pipeline/` (`types`, `services/pipelineApi.ts` with a `'Job'` tag, `hooks/useRetryJob.ts`, `components`, `index.ts`).
- `PipelinePage` at `/pipeline`, with tabs held in the URL (`?tab=live|failures`):
  - **Live:** StatCards for queued, running, dead, oldest pending, last reconcile and last report run. A job feed table polls at `LIVE_POLL_MS` (type, call or run link, status, attempt, error, age). **Reconcile now** sits here.
  - **Failures:** dead jobs with the error, a link to the call or report, and **Retry**.
- Sidebar: a **Pipeline** item with a red badge showing the dead job count.
- `SimulateCallMenu`: a **Drop next webhook** toggle (mock mode only). The top bar badge shows when it is armed.
- Call detail: **Retry** and the Drive link.

## 9. Docs and cleanup

- **`README.md` rewrite:** what the app does, a system diagram (from the upgrade plan, now with reconcile and the Drive archive), setup (Postgres, migrate, seed, LLM, env), a 5-minute demo script and the command list.
- **`docs/SOP.md`:** for each alert, what it means, the likely causes and what to do. It also covers the Retry and Assign flows and how to read `/health`.
- Delete `TESTING_GUIDE.md`, `backend/README.md` and `backend/q.tmp.js`.
- Update `ARCHITECTURE.md` (job types, endpoints, logging), `UPGRADE_PLAN.md` (Phase 4 done, coverage table), `CLAUDE.md` (new commands and layout) and both `.env.example` files.

## Backend changes

| File | Change |
| --- | --- |
| `backend/db/migrations/004_reliability.sql` | `mock_grain_recordings`; `calls.drive_file_id`, `drive_url`; index `jobs (status, updated_at)` for the feed |
| `backend/src/lib/logger.ts` | Logger and log context (new) |
| `backend/src/services/rateLimit.ts` | Token bucket (new) |
| `backend/src/db/jobsRepo.ts` | `retryJob`, `getQueueHealth`, `listJobs`, `getLastReconcile` |
| `backend/src/db/callsRepo.ts` | `setCallDrive`; return the Drive columns |
| `backend/src/db/mockGrainRepo.ts` | Record and list mock recordings (new) |
| `backend/src/types/pipeline.ts` | `reconcile_grain` JobType; Drive fields on `CallRow` |
| `backend/src/services/grain/grainConnector.ts`, `sampleCalls.ts` | `listRecordings`, drop flag; `expectedActionItems` |
| `backend/src/services/pipeline/processCall.ts`, `ingest.ts`, `jobHandlers.ts`, new `reconcile.ts` | Per-step resume, Drive step, review alert, reconcile handler |
| `backend/src/services/drive/renderCall.ts` | Call summary HTML (new) |
| `backend/src/services/alerts/opsAlerts.ts` | Keys, call and review alerts, reconcile alert |
| `backend/src/services/scheduler/` | Shared cron + catch-up for reports and reconcile (moves `reports/scheduler.ts`) |
| `backend/src/services/queue/worker.ts` | `withLogContext` per job; `onDead` for every type |
| `backend/src/services/llm/claudeProvider.ts`, `slack/slackClient.ts` | Rate limit |
| `backend/src/routes/pipeline.ts` (new), `demo.ts`, `calls.ts`, `index.ts` | API below; `/health` |
| `backend/src/scripts/eval.ts`, `package.json` | `eval` script |
| everything with `console.*` | Use the logger |

## API

```
GET  /api/pipeline/health                       queue counts, oldest pending, last hour, last reconcile, last report run, next crons
GET  /api/jobs?status=&type=&limit=             job feed (newest first)
POST /api/jobs/:id/retry                        dead job → pending; failed call → received   202 | 409
POST /api/pipeline/reconcile                    manual reconcile → 202 { jobId }
POST /api/demo/drop-next-webhook { enabled }    demo toggle (mock Grain only)
GET  /health                                    + queue, lastReportRun, lastReconcile; 503 if DB down
```

## Build order

1. Logger and log context, then migrate `console.*`. This comes first so every later step logs correctly.
2. Migration 004, `retryJob` and its route, and alerts for every dead job and for review calls.
3. Per-step `processCall` and the Drive archive.
4. Mock Grain memory, the drop toggle, the reconcile job, the shared scheduler and catch-up.
5. Rate limits.
6. Pipeline routes and `/health`, then the frontend: Pipeline page, Retry, drop toggle, Drive link, Review highlight.
7. Eval: annotate the samples, write the script, run it on Ollama.
8. README, SOP and doc updates; delete the stale files.

Type-check after each step (`cd backend && npm run type-check`, `npm run build`). End-to-end checks:
- A forced failure (an unknown mock sample ID) dead-letters, raises an alert, and recovers with Retry.
- A dropped webhook is recovered by Reconcile now.
- `simulate-week` with 50 calls drains with no dead jobs.

## As built (differences from the plan)

- **"Fail next call" demo switch** (`POST /api/demo/fail-next-call`, `services/pipeline/demoFaults.ts`): the next `process_call` fails permanently once. The planned forced failure (an unknown sample ID) can't be fixed by Retry, so it couldn't demo the recovery path.
- **Alerts:** the dead-job key uses the job's claim time (`alert:dead:<jobId>:<updated_at>`) rather than an attempt count, so a job that is retried and dies again alerts again. The Slack connector takes the key as `postMessage(message, { idempotencyKey })`; only the mock uses it.
- **Reconcile lookback** is measured from when Grain received the recording (`created_at`), not from when the call started, because simulate-week backdates `started_at`.
- **`db:reset-calls`** also clears `mock_grain_recordings`. Otherwise the next reconcile would re-ingest every deleted demo call.
- The reconcile startup catch-up also counts a pending or running reconcile, so a restart during a run doesn't queue a second one.

## Risks and cuts

- **Reconcile vs a live Grain API:** the mock lists from a table. The live version (list recordings `updated_after`) is designed in INTEGRATIONS.md, and only the connector changes.
- **Eval on Ollama** is slow (about 5 × 30–90 s) and may score lower than Claude. Both results are reported honestly, and the exit code reflects them.
- **Cut first if short on time:** the jobs-per-hour stats, the Review highlight, and the Pipeline sidebar badge. **Never cut:** Retry, the alerts, reconcile, and the Drive step, because those close the "no babysitting" and "no moving files" requirements.
