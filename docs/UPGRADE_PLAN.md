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
                                                         └▶ Drive archive (optional)

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

### Phase 3: Weekly reports (Day 3, morning)
- A `node-cron` job, plus a manual "Run now" button for the demo.
- **Coach report** (map-reduce over call summaries): `per_client[{progress, next_focus, watch_outs}]`, `coach_rating{score_1_5, rubric, evidence}`, `improvements[]`.
- **Manager report:** built from the coach reports. It covers `trends`, `sentiment_breakdown`, `top_concerns`, `content_ideas`, `at_risk_clients`.

### Phase 4: Reliability and demo (Day 3, afternoon)
- Retries with exponential backoff and jitter, a dead-letter status and a "Retry" button in the UI.
- Per-service rate limits (Claude, Slack). Structured logs with a `call_id` correlation ID.
- An `npm run eval` command over 5 sample transcripts that checks schema validity, owner accuracy and that no action items are made up.
- Dashboard pages: Pipeline (live SSE job feed), Calls, Reports, Failures/Review.
- A README with the system diagram and setup steps, and a short SOP.

### Stretch (only if time allows)
- Google Drive archiving, a real Grain API connector, deployment (Railway + Vercel), Slack alerts on failures.

## Top failure modes to design for (also for the sketch)

1. **Duplicate or missed webhooks:** an idempotency key, plus a nightly reconcile that polls Grain for missed recordings.
2. **Wrong client channel or wrong action-item owner:** deterministic matching, a review queue for misses, and owners restricted to participants.
3. **API limits and malformed LLM output at volume:** a queue with backoff, honoring `Retry-After`, schema validation with one repair retry, then dead-letter plus an alert.

## Open questions (sent to Operations.com)

- An example of their summary format.
- Whether a personal project is acceptable for the Part 1 video.
