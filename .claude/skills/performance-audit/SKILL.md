---
name: performance-audit
description: Audit the app for performance problems such as slow call summaries, a backed-up job queue, duplicate or over-eager polling, slow SQL, or unnecessary re-renders. Use when something feels slow.
argument-hint: page, component or service to audit
---

# Performance Audit

Audit `$ARGUMENTS`, or the whole app if none is given. Measure before changing anything.

## Checks

1. **Polling.** Count requests in the Network tab for 30 s on each page. List pages poll every `LIVE_POLL_MS`. RTK Query dedupes identical args, so two subscribers with the same filters should make one request. `useCallDetail` must stop polling once a call settles. Look for args objects that differ each render (new cache entries) and for polling on pages that don't need live state.
2. **Pipeline latency.** Read the backend `📞 [call …]` logs and the `jobs` table (`attempts`, `last_error`, `run_at`). Summaries dominate, especially local `deepseek-r1` (minutes on CPU spill). Check the job retry rate and whether jobs are waiting on backoff.
3. **SQL.** Run `explain analyze` on the list queries in `callsRepo.ts` and `directoryRepo.ts`. They use correlated subqueries and a lateral join on `jobs`. Check that the indexes in `db/migrations/` are used as data grows (`calls_status_idx`, `calls_coach_started_idx`, `jobs_call_id_idx`).
4. **Re-renders.** Components are presentational. Check that pages don't pass new inline objects or arrays to large tables on every poll (React Profiler), and that `useAppSelector` selectors stay narrow.
5. **Bundle.** `npm run build` warns above 500 kB. Consider route-level `lazy()` before tuning anything else.

## Report

List each check as ✅ or ⚠️, with the evidence (a request count, a log line, an `explain` plan or a profiler result) and a concrete fix with its file path.
