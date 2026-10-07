# Upgrade Plan: Coaching Call Intelligence

This rebuilds the speech-to-text app as a working prototype of the Operations.com technical-screen scenario (Grain → Claude → Slack/Drive, with per-call summaries and weekly coach and manager reports).

**Deadline:** 3 days. The written sketch and the video are the required deliverables. This prototype is an optional extra.

## Priorities

1. **Day 1, required:** record the Part 1 video and write the Part 2 sketch (300–600 words, PDF).
2. **Days 2–3, extra:** build the prototype below. Cut scope rather than miss the deadline.

## What stays, what goes

Done in the redesign (between Phase 2 and Phase 3): the app now contains only calls, clients and coaches.

| Kept | Removed |
| --- | --- |
| Express backend, LLM provider abstraction (Claude + Ollama fallback) | Voice commands, handler and command registries, `/api/ai/*` and `/api/config/*` |
| Logging system, Chakra UI, Redux (now with RTK Query) | Web Speech capture and browser recording (Grain records meetings itself; the demo uses mock samples) |
| Call pipeline, job queue, Grain mock connector, Slack poster | Production lines, intent routing, RAG, embeddings (`nomic-embed-text` no longer needed) |

## Target architecture

```
Grain webhook ─▶ POST /webhooks/grain ─▶ calls table (unique grain_recording_id)
   (or mock samples)                           │
                                               ▼
                                   job queue (Postgres) ──▶ Claude: call summary (JSON schema)
                                               │                    │
                                               ▼                    ▼
                                    match coach/client ──▶ Slack chat.postMessage (Block Kit)
                                                         └▶ Drive archive

Weekly cron (Mon 7:00 CT) ─▶ coach reports (from summaries, not transcripts)
                         └─▶ manager report (from coach reports) ─▶ Slack + Drive
```

## Phases

### Phase 1: Foundation (Day 2, morning)
- Add an LLM provider interface with Claude as the default (`@anthropic-ai/sdk`) and Ollama as the fallback.
- Postgres via Supabase. The tables are `coaches`, `clients` (`slack_channel_id`), `calls` (unique `grain_recording_id`), `call_summaries`, `reports` and `jobs`.
- Validate every LLM output with zod. Use structured outputs (tool or JSON schema) instead of regex JSON parsing.

### Phase 2: Per-call pipeline (Day 2, afternoon)
- `POST /webhooks/grain` checks the signature, stores the call and enqueues a job. It returns 200 immediately and ignores duplicates.
- A Grain connector with **mock mode** (sample transcripts plus a "Simulate call" button).
- Match each call to a coach and client by participant email, then by a title rule. Calls that don't match go to a review queue and are never posted to a guessed channel.
- **Summary schema:** `overview`, `key_points[]`, `action_items[{owner, owner_role, task, due}]`, `client_sentiment`, `risks[]`, `notable_quotes[]`. Owners must be call participants.
- Post to Slack as Block Kit. Honor `Retry-After` on a 429. Store the message `ts` so a retry never double-posts.

### Redesign (done)
- Removed everything outside calls, clients and coaches (see the table above).
- Backend: routes split into `calls.ts`, `directory.ts` (read-only clients and coaches) and `demo.ts`. Call list filters (`status`, `clientId`, `coachId`, paging). Client and coach detail endpoints.
- Frontend: React Router shell (sidebar, top bar with **Simulate call**). Pages: Calls, Call detail, Review queue, Clients, Client profile, Coaches, Coach profile, Reports placeholder. Server data comes through RTK Query with polling.
- Phase 3 plugs into `/reports` and the "Weekly report" panel on the coach profile.

### Phase 3: Weekly reports (done)
Detailed plan: [PHASE3_PLAN.md](PHASE3_PLAN.md).
- A `node-cron` schedule (Mon 7:00 CT) is the trigger, with a startup catch-up for a missed Monday. A manual run exists only for backfills and reruns.
- **Coach report** (map-reduce over call summaries): `per_client[{progress, next_focus, watch_outs}]`, judged against last week's focus. `coach_rating` uses a fixed rubric with evidence call IDs. Also `improvements[]` and `attention[]`.
- **Manager report:** built from the coach reports. Covers `trends`, sentiment (counted in SQL, explained by the LLM), `client_concerns`, `content_ideas`, `at_risk_clients` and `coach_highlights`.
- Both are delivered to Slack (coach DM, manager channel) and archived to Google Drive. Both services are mocks that write to an outbox shown in the dashboard.
- Built: jobs `weekly_reports` → `coach_report` × N → `manager_report` (gate) on the existing queue; `integration_outbox` + `/outbox` page; ops alerts for dead report jobs and partial runs (the alert helper Phase 4 extends); `simulate-week` and `reports:check`. The per-call Slack post goes through the same mock connector.

### Phase 4: Reliability and demo (Day 3, afternoon)
- Retries with exponential backoff and jitter and a dead-letter status (done in Phase 2). Add a "Retry" button in the UI.
- **Ops alerts to Slack** (`SLACK_OPS_CHANNEL_ID`, delivered to the mock outbox): a dead job, a call sent to the review queue (with a link to assign it), and a partial report run. "No babysitting" means problems come to people; nobody checks a dashboard.
- **Nightly reconcile** against the mock Grain connector. The mock gains `listRecordings(since)`, and a demo toggle "drop next webhook" shows a missed call being recovered. The existing `grain:<id>` idempotency key makes this safe.
- **Drive archive per call:** an `archive_drive` step in `processCall` after Slack, using the Phase 3 Drive mock.
- **Integrations stay mocked** (no paid services). The live designs are in [INTEGRATIONS.md](INTEGRATIONS.md).
- Per-service rate limits (Claude, Slack). Structured logs with a `call_id` correlation ID.
- An `npm run eval` command over 5 sample transcripts that checks schema validity, owner accuracy and that no action items are made up.
- Dashboard: a Pipeline page (live job feed and queue health) and a Failures view. `/health` reports queue depth, the oldest pending job and the last report run.
- A README with the system diagram and setup steps, and a short SOP (what each alert means and what to do).

### Stretch (only if time allows)
- Deployment (Railway + Vercel) with the worker and scheduler always on, and the business's own summary format and rubric once received.

### Future: live integrations (out of scope for the demo)
- Live Grain, Slack and Drive connectors, built to the design in [INTEGRATIONS.md](INTEGRATIONS.md). Each is a new implementation of an existing connector interface plus env config. The pipeline doesn't change.

## Scenario coverage

How the scenario's requirements map to the app. Grain, Slack and Drive are mocked throughout; "Done" means it works end to end against the mocks.

| Requirement | Status | Where |
| --- | --- | --- |
| Per call: structured summary, posted to the client's Slack channel | Done | Phase 2 pipeline |
| Action items with clear owners | Done (owners must be participants) | `summarizeCall.ts` |
| "In our format" | Open: waiting for their example | `callSummary.ts`, `summaryBlocks.ts` |
| Weekly coach report: per client, focus, progress, rating, feedback, watch-outs | Done | Phase 3 (`services/reports/coachReport.ts`) |
| Weekly manager report: trends, sentiment, concerns, content ideas | Done | Phase 3 (`services/reports/managerReport.ts`) |
| No manual uploading: calls arrive from Grain automatically | Done (mock webhook path); live designed | Phase 2; [INTEGRATIONS.md](INTEGRATIONS.md#grain) |
| No babysitting: missed webhooks recovered | Planned (against mock) | Phase 4 nightly reconcile |
| No babysitting: failures and unmatched calls reach a person | Partly done: report failures alert ops (mock outbox); call failures and review queue planned | Phase 3 `opsAlerts.ts`; Phase 4 ops alerts |
| No moving of files: Google Drive | Done for reports (mock outbox); calls planned; live designed | Phase 3 (reports), Phase 4 (calls); [INTEGRATIONS.md](INTEGRATIONS.md#google-drive) |
| Reliable at 50+ calls a week | Mostly done: queue, backoff, idempotency, dead-letter | Phase 4 rate limits, eval, volume test through `simulate-week` |
| Runs unattended (server always on) | **Gap:** local only (cron + startup catch-up done) | Stretch: deployment |

## Top failure modes to design for (also for the sketch)

1. **Duplicate or missed webhooks:** an idempotency key, plus a nightly reconcile that polls Grain for missed recordings.
2. **Wrong client channel or wrong action-item owner:** deterministic matching, a review queue for misses, and owners restricted to participants.
3. **API limits and malformed LLM output at volume:** a queue with backoff, honoring `Retry-After`, schema validation with one repair retry, then dead-letter plus an alert.

## Open questions (sent to Operations.com)

- An example of their summary format.
- Whether a personal project is acceptable for the Part 1 video.
