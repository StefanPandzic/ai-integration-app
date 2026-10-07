# Architecture: Coaching Call Intelligence

**Last updated:** October 7, 2026

The app ingests coaching calls (Grain, or mock samples in demo mode), summarizes each call with an LLM, posts the summary to the client's Slack channel, and shows calls, clients and coaches in a dashboard. Weekly reports are Phase 3 (see [UPGRADE_PLAN.md](UPGRADE_PLAN.md)).

## System overview

```
Grain webhook ─▶ POST /webhooks/grain ─┐
Simulate call ─▶ POST /api/demo/...  ──┼─▶ job: ingest_grain_recording ─▶ calls row (unique grain_recording_id)
POST /api/calls (other sources) ───────┘                                      │
                                                                              ▼
                                       job: process_call ─▶ match ─▶ summarize ─▶ Slack
                                                              │
                                                              └─▶ no match: status needs_review
                                                                  (assigned by hand in /review)

React dashboard ◀── RTK Query (polling) ── /api/calls, /api/clients, /api/coaches, /api/demo
```

Every entry point stores work and returns right away. The Postgres job worker does the slow parts.

## Backend (`backend/src/`)

| Area | Files | Role |
| --- | --- | --- |
| Entry | `index.ts` | Express app, routers, `/health`, starts the job worker when `DATABASE_URL` is set |
| Routes | `routes/calls.ts`, `directory.ts`, `demo.ts`, `webhooks.ts` | HTTP API (below); shared helpers in `routes/helpers.ts` |
| Ingest | `services/pipeline/ingest.ts` | `acceptGrainRecording`, `ingestCall`, `assignCall`; all idempotent |
| Jobs | `services/pipeline/jobHandlers.ts`, `services/queue/worker.ts`, `db/jobsRepo.ts` | One job at a time, `FOR UPDATE SKIP LOCKED`, exponential backoff with jitter, dead-letter |
| Pipeline | `services/pipeline/processCall.ts`, `matching.ts`, `summarizeCall.ts` | Match → summarize → Slack. Each step is persisted, so a retry skips finished steps |
| LLM | `services/llm/` | `generateStructured()`: Claude (structured outputs) with an Ollama fallback; zod-validated, one repair retry |
| Grain | `services/grain/` | Connector (`GRAIN_MODE=mock` serves `sampleCalls.ts`), webhook signature check |
| Slack | `services/slack/` | Block Kit message, honors `Retry-After`; dry run without `SLACK_BOT_TOKEN` |
| Data | `db/*Repo.ts`, `db/migrations/*.sql` | `coaches`, `clients`, `calls`, `call_summaries`, `reports`, `jobs` |

### Call statuses

`received` → `summarized` → `posted`. If the call can't be matched it becomes `needs_review`. Assigning a client sets it back to `received` and the pipeline runs again. When the job is dead-lettered the call becomes `failed`.

### Matching rules (deterministic)

1. Client: a participant email matches exactly one client. Otherwise a title keyword matches exactly one client.
2. Coach: the single coach on the call (by email). Otherwise the client's assigned coach.
3. Anything ambiguous goes to `needs_review`. Nothing is ever posted to a guessed channel.

### HTTP API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/calls?status=&clientId=&coachId=&limit=&offset=` | List with client/coach names, summary sentiment, action-item count and latest job state |
| GET | `/api/calls/:id` | `{ call, summary, client, coach, job }` |
| POST | `/api/calls` | Ingest a call from another source (`source: 'browser'`) |
| POST | `/api/calls/:id/assign` | Resolve a review-queue (or failed) call |
| GET | `/api/clients?coachId=` | Clients with call count, last call date and latest sentiment |
| GET | `/api/clients/:id` | `{ client, calls, summaries }` (summaries newest first) |
| GET | `/api/coaches` | Coaches with client count, calls total and calls in the last 7 days |
| GET | `/api/coaches/:id` | `{ coach, clients, calls }` |
| GET | `/api/demo/samples` | Grain mode, Slack dry-run flag, mock samples |
| POST | `/api/demo/simulate-call` | Sends a mock sample through the webhook path (`GRAIN_MODE=mock` only) |
| POST | `/webhooks/grain` | Signature check, then enqueue, then 200. Duplicates are acknowledged and ignored |

Coaches and clients are read-only and come from `npm run db:seed`.

## Frontend (`src/`)

```
main.tsx      Redux Provider → PersistGate → ChakraProvider(theme) → BrowserRouter → App
App.tsx       AppShell wiring (simulate call, review badge, color mode) + routes
pages/        One component per route; pages call hooks and pass props down
features/
  calls/      callsApi (RTK Query), useCallDetail, useAssignCall, table/detail/summary/review components
  clients/    clientsApi, ClientsTable, ClientInsights
  coaches/    coachesApi, CoachCards
  layout/     AppShell (sidebar, drawer on mobile, top bar), SimulateCallMenu
  logging/    createLogger('<feature>')
components/   Shared presentational primitives (Panel, PageHeader, StatCard, EmptyState, QueryState, BackLink)
store/        api.ts (RTK Query base), slices/appSlice.ts (color mode), persisted with redux-persist
theme.ts      Chakra theme (brand indigo scale, Inter)
```

| Route | Page |
| --- | --- |
| `/calls` | Calls table, with filters stored in the URL (`?status=&coachId=&clientId=`) |
| `/calls/:id` | Summary and transcript tabs, details, pipeline state, assign picker for review calls |
| `/review` | `needs_review` queue with the assign picker |
| `/clients`, `/clients/:id` | Client list; profile with stats, sentiment over time, latest commitments, recent risks, calls |
| `/coaches`, `/coaches/:id` | Coach cards; roster, recent calls and a weekly-report slot (Phase 3) |
| `/reports` | Placeholder for Phase 3 |

### Data fetching

- Server data lives only in the RTK Query cache (`store/api.ts`). Each feature injects its own endpoints, and the cache is never persisted.
- List pages poll every `LIVE_POLL_MS` (3 s), because calls change state in the background. `useCallDetail` polls only while the call is still being processed.
- Mutations (`assignCall`, `simulateCall`) invalidate the `Call`, `Client` and `Coach` tags.
