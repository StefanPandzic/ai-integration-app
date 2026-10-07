# Coaching Call Intelligence

React + TypeScript dashboard (Vite, Chakra UI, Redux Toolkit + RTK Query, React Router) for coaching calls, clients and coaches, with a Node/Express backend that owns all AI and pipeline logic (Grain → LLM summary → Slack, plus weekly coach/manager reports → Slack + Drive). Grain, Slack and Drive are mocks; Slack/Drive write to an outbox shown at `/outbox` (live designs: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)). Upgrade in progress: see [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md). Architecture and API reference: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

```bash
npm run dev            # frontend (Vite, :5173)
npm run build          # tsc + vite build — run to type-check frontend
cd backend && npm run dev         # backend (ts-node-dev, :3001)
cd backend && npm run type-check  # type-check backend
cd backend && npm run db:migrate  # apply backend/db/migrations/*.sql (needs DATABASE_URL)
cd backend && npm run db:seed     # demo coaches/clients matching the mock Grain sample calls
cd backend && npm run db:reset-calls  # delete all calls, summaries and jobs (keeps coaches/clients)
cd backend && npm run llm:check   # structured-output smoke test (`-- ollama` forces a provider)
cd backend && npm run reports:check -- <coachId> [YYYY-MM-DD]  # print a coach report without saving
```

No test framework yet. Until `ANTHROPIC_API_KEY` is set, summaries use local Ollama (`deepseek-r1`) — see [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

## Layout

- `backend/src/services/llm/` — `generateStructured()`: Claude (structured outputs) with Ollama fallback; all output zod-validated. Schemas in `backend/src/schemas/`
- `backend/src/db/` — `pg` pool, migration runner, seed, and `*Repo.ts` query modules; SQL in `backend/db/migrations/`
- `backend/src/services/pipeline/` — call pipeline: `ingest.ts` (entry points) → jobs → `processCall.ts` (match → summarize → Slack). Siblings: `queue/` is the Postgres job worker (backoff, dead-letter); `grain/` the connector (`GRAIN_MODE=mock` sample calls) and webhook signature; `slack/` the Block Kit builders and connector
- `backend/src/services/reports/` — weekly reports: `runWeeklyReports.ts` (jobs `weekly_reports` → `coach_report` × N → `manager_report`, delivery), `scheduler.ts` (`REPORTS_CRON`, startup catch-up), `coachReport.ts`/`managerReport.ts` (LLM writes, code counts; refs checked in `grounding.ts`). Rubric in `backend/src/schemas/coachReport.ts`
- `backend/src/services/drive/`, `services/slack/`, `services/alerts/` — `DriveConnector`/`SlackConnector` (`*_MODE=mock` → `integration_outbox`), ops alerts
- `backend/src/routes/` — `webhooks.ts` (`/webhooks/grain`), `calls.ts` (`/api/calls`), `directory.ts` (`/api/clients`, `/api/coaches`, read-only), `reports.ts` (`/api/reports`), `outbox.ts` (`/api/outbox`), `demo.ts` (`/api/demo/*`)
- `backend/src/config/aiModels.ts` — LLM provider settings and Ollama model metadata; `config/integrations.ts` — connector modes, channels, report cron
- `src/pages/` — one component per route; `App.tsx` holds the routes and wires `AppShell`
- `src/features/{calls,clients,coaches,reports,outbox,layout,logging}/` — `components/ hooks/ services/ types/ index.ts`
- `src/components/` — shared presentational primitives (`Panel`, `PageHeader`, `StatCard`, `QueryState`…)
- `src/store/` — `api.ts` (RTK Query base), `slices/appSlice.ts` (color mode, persisted)

## Conventions

- **Backend owns AI.** The frontend never calls an LLM; it only reads the REST API.
- **Server data → RTK Query.** Each feature injects endpoints into `store/api.ts` from `services/<feature>Api.ts` and exports the generated hooks. Use tags for invalidation and `LIVE_POLL_MS` polling for pipeline state. Never copy server data into slices or `useState`.
- **Pages → Hooks → Components.** Pages (and `App.tsx`) call query/mutation hooks and feature hooks (`hooks/`, for logic such as conditional polling or toasts). Components are presentational and receive everything via props.
- **State:** Redux slices only for client UI state (`useAppSelector` with narrow selectors, `useAppDispatch`); `useState` only for transient UI. Never call `localStorage` manually for persisted state.
- **Styling:** Chakra UI only; colors from `useAppColors()` in `src/constants/colors.ts` (`brand` scale in `src/theme.ts`). No CSS modules or inline styles.
- **Logging:** never `console.*` in frontend — use `createLogger('<feature>')` from `src/features/logging`.
- **TypeScript:** strict, no `any`. Frontend env vars need the `VITE_` prefix; model config lives in `aiModels.ts`, not `.env`. Frontend types in `features/*/types` mirror backend row shapes.
- Feature folders export through a barrel `index.ts`.
