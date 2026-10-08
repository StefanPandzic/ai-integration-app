# Coaching Call Intelligence

Every coaching call is summarized automatically and posted to the client's Slack channel, with action items and clear owners. Every Monday each coach gets a report on their week, and the manager gets a roll-up of the whole portfolio. Nobody uploads files and nobody watches a dashboard. Missed webhooks are recovered every night, and every failure or unmatched call reaches a person in Slack, along with a one-click fix.

This is a working prototype of the Operations.com technical-screen scenario. Grain, Slack and Google Drive are **mocked**, so it runs locally at no cost. Slack and Drive write to an outbox you can browse in the dashboard. The live connector designs are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## How it works

```
Grain webhook ─▶ POST /webhooks/grain ──┐
nightly reconcile (2:00 CT) ────────────┼─▶ job: fetch recording ─▶ calls (unique per Grain recording)
  lists Grain, re-sends missed ones     │                                 │
                                                                          ▼
                     job: process_call ─▶ match client/coach ─▶ LLM summary ─▶ Slack (client channel) ─▶ Drive archive
                                               │                (Gemini, zod-validated,
                                               ▼                 owners must be participants)
                                        no match → review queue + ops alert

cron Mon 7:00 CT ─▶ coach report × N (from summaries) ─▶ manager report (from coach reports) ─▶ Slack + Drive

any job out of retries ─▶ dead-letter ─▶ ops alert in Slack ─▶ Retry in the dashboard
```

- **Postgres job queue** (`FOR UPDATE SKIP LOCKED`): exponential backoff with jitter, dead-lettering, and idempotency keys on every entry point. Every step stores its result, so a retry never double-posts.
- **The LLM writes, code counts.** Structured outputs are validated with zod. Action-item owners must be call participants. Report statistics come from SQL, and every reference the model cites is checked against its input.
- **Problems come to people.** Dead jobs, unmatched calls, partial report runs and recovered recordings all post to the ops channel. See [docs/SOP.md](docs/SOP.md).

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Build history and scope: [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md).

## Setup

Requirements: Node 20+, Postgres 15+ (local or Supabase), and either a Google Gemini API key (free at aistudio.google.com/apikey) or [Ollama](OLLAMA_SETUP.md) with `deepseek-r1`.

```bash
# 1. Install
npm install
cd backend && npm install

# 2. Configure (backend/.env): DATABASE_URL, and GEMINI_API_KEY if you use Gemini
cp .env.example .env            # in backend/
cp .env.example .env            # in the repo root (VITE_BACKEND_URL)

# 3. Database
npm run db:migrate              # in backend/: creates the database locally if missing
npm run db:seed                 # demo coaches and clients that match the sample calls

# 4. Run (two terminals)
cd backend && npm run dev       # API, job worker and schedulers on :3001
npm run dev                     # dashboard on :5173
```

The LLM provider is set in `backend/src/config/aiModels.ts`. It uses local Ollama until `GEMINI_API_KEY` is set; then Gemini Flash is primary, with Gemini Flash Lite and then Ollama as fallbacks. `npm run llm:check` (in `backend/`) checks that the provider works.

## 5-minute demo

1. **A call arrives.** Press **Simulate call → Coaching session: Marcus / Dana**. The call appears in **Calls**, gets summarized, and the summary shows up in **Outbox → Slack** (the client's channel) and **Outbox → Drive** (`Calls/<Client>/<month>`).
2. **An unknown call.** Simulate **Intro call**. It lands in the **Review queue**, and an alert appears in `#coaching-ops` (Outbox). The alert's button opens the queue with the call highlighted. Assign a client, and the summary is posted.
3. **A missed webhook.** Choose **Simulate call → Drop next webhook**, then simulate any call. Nothing appears in Calls. Open **Pipeline → Reconcile now** (normally nightly): the call is recovered and ops gets a "Recovered 1 missed recording" alert.
4. **A failure.** Choose **Fail next call**, then simulate a call. The job dies, the call shows **Failed**, and ops is alerted. Press **Retry** on the call page or in **Pipeline → Failures**, and it goes through.
5. **Weekly reports.** Press **Simulate week** (backdated calls across last week). When they're summarized, go to **Reports → Rerun week** (normally Monday 7:00 CT). Coach DMs and the manager overview appear in the Outbox, with Drive copies.
6. **Health.** Open `http://localhost:3001/health` to see queue depth, the oldest waiting job, the last reconcile and the last report run.

## Commands

| Where | Command | What it does |
| --- | --- | --- |
| root | `npm run dev` / `npm run build` | Dashboard dev server / type-check and build |
| backend | `npm run dev` | API, worker and crons, with reload |
| backend | `npm run type-check` | Type-check the backend |
| backend | `npm run db:migrate` / `db:seed` | Apply migrations / seed the demo directory |
| backend | `npm run db:reset-calls` | Delete all calls, summaries, jobs and mock recordings (keeps coaches, clients and reports) |
| backend | `npm run eval` | Summarize the 5 sample calls and score schema validity, action-item recall, owner accuracy and made-up items (`-- ollama` forces a provider, `-- --json out.json` saves results). Exits 1 on any failure |
| backend | `npm run llm:check` | Structured-output smoke test |
| backend | `npm run reports:check -- <coachId> [YYYY-MM-DD]` | Print a coach report without saving it |

## Configuration

All settings are in `backend/.env.example`, with comments. The ones that matter most:

| Variable | Default | |
| --- | --- | --- |
| `GRAIN_MODE`, `SLACK_MODE`, `DRIVE_MODE` | `mock` | Live connectors are designed in [INTEGRATIONS.md](docs/INTEGRATIONS.md); only Slack has a live implementation |
| `SLACK_OPS_CHANNEL_ID` | `#coaching-ops` | Where alerts go |
| `REPORTS_CRON` | `0 7 * * 1` | Weekly reports, America/Chicago |
| `RECONCILE_CRON`, `RECONCILE_LOOKBACK_HOURS` | `0 2 * * *`, `48` | Nightly Grain reconcile |
| `LOG_FORMAT` | `pretty` | `json` for one structured line per event, each carrying `jobId` and `callId` or `runId` |

## Project layout

```
backend/src/
  routes/           webhooks, calls, directory, reports, outbox, pipeline, demo
  services/
    pipeline/       ingest → processCall (match → summarize → Slack → Drive), reconcile
    queue/          Postgres job worker
    reports/        weekly coach and manager reports
    scheduler/      report and reconcile crons with startup catch-up
    grain/ slack/ drive/   connectors (mock + live interface)
    alerts/         ops alerts
    llm/            Gemini / Ollama structured generation
  db/               pg pool, migrations runner, repositories
  lib/logger.ts     structured logger with per-job context
src/                React dashboard (Vite, Chakra UI, Redux Toolkit + RTK Query)
  pages/            one per route
  features/         calls, clients, coaches, reports, outbox, pipeline, layout, logging
docs/               architecture, plans, integrations, SOP
```
