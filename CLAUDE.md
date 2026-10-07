# Coaching Call Intelligence

React + TypeScript dashboard (Vite, Chakra UI, Redux Toolkit + RTK Query, React Router) for coaching calls, clients and coaches, with a Node/Express backend that owns all AI and pipeline logic (Grain → LLM summary → Slack + Drive, weekly coach/manager reports → Slack + Drive, nightly Grain reconcile, ops alerts). Grain, Slack and Drive are mocks; Slack/Drive write to an outbox shown at `/outbox` (live designs: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)). Upgrade history: [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md) (all phases done). Ops runbook: [docs/SOP.md](docs/SOP.md). Architecture and API reference: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

```bash
npm run dev            # frontend (Vite, :5173)
npm run build          # tsc + vite build — run to type-check frontend
cd backend && npm run dev         # backend (ts-node-dev, :3001)
cd backend && npm run type-check  # type-check backend
cd backend && npm run db:migrate  # apply backend/db/migrations/*.sql (needs DATABASE_URL)
cd backend && npm run db:seed     # demo coaches/clients matching the mock Grain sample calls
cd backend && npm run db:reset-calls  # delete all calls, summaries, jobs and mock Grain recordings (keeps coaches/clients)
cd backend && npm run llm:check   # structured-output smoke test (`-- ollama` forces a provider)
cd backend && npm run reports:check -- <coachId> [YYYY-MM-DD]  # print a coach report without saving
cd backend && npm run eval        # score summaries of the 5 samples (`-- ollama`, `-- --json out.json`); exit 1 on failure
```

No test framework yet; `npm run eval` is the LLM quality check. Until `GEMINI_API_KEY` is set, summaries use local Ollama (`deepseek-r1`); with it, Gemini is primary and Ollama the fallback — see [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

## Layout

- `backend/src/services/llm/` — `generateStructured()`: Gemini (`@google/genai`, structured outputs) with Ollama fallback; all output zod-validated. Schemas in `backend/src/schemas/`
- `backend/src/db/` — `pg` pool, migration runner, seed, and `*Repo.ts` query modules; SQL in `backend/db/migrations/`
- `backend/src/services/pipeline/` — call pipeline: `ingest.ts` (entry points) → jobs → `processCall.ts` (match → summarize → Slack → Drive, each step resumable); `reconcile.ts` (nightly `reconcile_grain`); `demoFaults.ts`. Siblings: `queue/` is the Postgres job worker (backoff, dead-letter, per-job log context); `grain/` the connector (`GRAIN_MODE=mock` sample calls, `mockGrain.ts` recording memory + drop-webhook switch) and webhook signature; `slack/` the Block Kit builders and connector; `rateLimit.ts` token buckets (Gemini, Slack)
- `backend/src/services/scheduler/` — crons (`REPORTS_CRON`, `RECONCILE_CRON`) with startup catch-up
- `backend/src/services/reports/` — weekly reports: `runWeeklyReports.ts` (jobs `weekly_reports` → `coach_report` × N → `manager_report`, delivery), `coachReport.ts`/`managerReport.ts` (LLM writes, code counts; refs checked in `grounding.ts`). Rubric in `backend/src/schemas/coachReport.ts`
- `backend/src/services/drive/`, `services/slack/`, `services/alerts/` — `DriveConnector`/`SlackConnector` (`*_MODE=mock` → `integration_outbox`), ops alerts (every dead job, review calls, partial runs, recovered recordings; keyed)
- `backend/src/lib/logger.ts` — `createLogger(scope)`, `withLogContext({ jobId, callId, runId })`; `LOG_FORMAT=pretty|json`
- `backend/src/routes/` — `webhooks.ts` (`/webhooks/grain`), `calls.ts` (`/api/calls`), `directory.ts` (`/api/clients`, `/api/coaches`, read-only), `reports.ts` (`/api/reports`), `outbox.ts` (`/api/outbox`), `pipeline.ts` (`/api/pipeline/*`, `/api/jobs`, retry), `demo.ts` (`/api/demo/*`)
- `backend/src/config/aiModels.ts` — LLM provider settings and Ollama model metadata; `config/integrations.ts` — connector modes, channels, crons, Slack rate limit
- `src/pages/` — one component per route; `App.tsx` holds the routes and wires `AppShell`
- `src/features/{calls,clients,coaches,reports,outbox,pipeline,layout,logging}/` — `components/ hooks/ services/ types/ index.ts`
- `src/components/` — shared presentational primitives (`Panel`, `PageHeader`, `StatCard`, `QueryState`…)
- `src/store/` — `api.ts` (RTK Query base), `slices/appSlice.ts` (color mode, persisted)

## Conventions

- **Backend owns AI.** The frontend never calls an LLM; it only reads the REST API.
- **Server data → RTK Query.** Each feature injects endpoints into `store/api.ts` from `services/<feature>Api.ts` and exports the generated hooks. Use tags for invalidation and `LIVE_POLL_MS` polling for pipeline state. Never copy server data into slices or `useState`.
- **Pages → Hooks → Components.** Pages (and `App.tsx`) call query/mutation hooks and feature hooks (`hooks/`, for logic such as conditional polling or toasts). Components are presentational and receive everything via props.
- **State:** Redux slices only for client UI state (`useAppSelector` with narrow selectors, `useAppDispatch`); `useState` only for transient UI. Never call `localStorage` manually for persisted state.
- **Styling:** Chakra UI only; colors from `useAppColors()` in `src/constants/colors.ts` (`brand` scale in `src/theme.ts`). No CSS modules or inline styles.
- **Logging:** never `console.*` in frontend — use `createLogger('<feature>')` from `src/features/logging` (register new feature names in its types/config). Backend uses `createLogger('<scope>')` from `backend/src/lib/logger.ts`; `console.*` only in CLI scripts.
- **TypeScript:** strict, no `any`. Frontend env vars need the `VITE_` prefix; model config lives in `aiModels.ts`, not `.env`. Frontend types in `features/*/types` mirror backend row shapes.
- Feature folders export through a barrel `index.ts`.
