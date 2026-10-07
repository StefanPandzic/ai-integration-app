# Speech-to-Text AI App

React + TypeScript frontend (Vite, Chakra UI, Redux Toolkit) with a Node/Express backend that owns all AI logic (Ollama, embeddings, RAG, intent routing). Upgrade in progress: see [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md). Full data-flow reference: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

```bash
npm run dev            # frontend (Vite, :5173)
npm run build          # tsc + vite build — run to type-check frontend
cd backend && npm run dev         # backend (ts-node-dev, :3001)
cd backend && npm run type-check  # type-check backend
cd backend && npm run db:migrate  # apply backend/db/migrations/*.sql (needs DATABASE_URL)
cd backend && npm run db:seed     # demo coaches/clients matching the mock Grain sample calls
cd backend && npm run llm:check   # structured-output smoke test (`-- ollama` forces a provider)
```

No test framework yet. Ollama must be running locally (`deepseek-r1`, `nomic-embed-text`) — see [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

## Layout

- `backend/src/services/` — `queryService.ts` (pipeline orchestrator), `ollamaClient.ts`, `embedClient.ts`, `ragService.ts`, `intentRouting.ts`, `promptBuilder.ts`, `jsonParser.ts`
- `backend/src/services/llm/` — `generateStructured()`: Claude (structured outputs) with Ollama fallback; all output zod-validated. Schemas in `backend/src/schemas/`
- `backend/src/db/` — `pg` pool, migration runner, seed, and `*Repo.ts` query modules; SQL in `backend/db/migrations/`
- `backend/src/services/pipeline/` — call pipeline: `ingest.ts` (entry points) → jobs → `processCall.ts` (match → summarize → Slack). Siblings: `queue/` is the Postgres job worker (backoff, dead-letter); `grain/` the connector (`GRAIN_MODE=mock` sample calls) and webhook signature; `slack/` the Block Kit poster (dry run without `SLACK_BOT_TOKEN`)
- `backend/src/routes/` — `/webhooks/grain`, `/api/calls`, `/api/clients`, `/api/demo/*`
- `backend/src/config/` — `aiModels.ts` (model metadata), `commandRegistry.ts`, `appKnowledgeBase.ts`
- `src/features/{speech,ai,production,calls,logging}/` — each with `components/ hooks/ services/ types/ index.ts`
- `src/store/slices/` — Redux slices; Redux Persist syncs to localStorage

## Conventions

- **Backend owns AI.** The frontend never calls Ollama directly; it uses `POST /api/ai/query` (SSE) and `POST /api/ai/embed` via `backendService.ts`.
- **Service → Hook → Component.** Services are factory functions (closure state, no React). Hooks hold service instances in `useRef`. Components are presentational and receive everything via props; only `App.tsx` wires hooks.
- **State:** Redux for global state (`useAppSelector` with narrow selectors, `useAppDispatch`); `useState` only for transient UI. Never call `localStorage` manually for persisted state.
- **Styling:** Chakra UI only; colors from `useAppColors()` in `src/constants/colors.ts`. No CSS modules or inline styles.
- **Logging:** never `console.*` in frontend — use `createLogger('<feature>')` from `src/features/logging`.
- **TypeScript:** strict, no `any`. Frontend env vars need the `VITE_` prefix; model config lives in `aiModels.ts`, not `.env`.
- Feature folders export through a barrel `index.ts`.
