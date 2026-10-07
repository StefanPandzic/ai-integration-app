---
name: performance-audit
description: Audit the app for performance problems such as slow AI responses, duplicate backend calls, unnecessary re-renders or Redux Persist bloat. Use when something feels slow.
argument-hint: component or service to audit
---

# Performance Audit

Audit `$ARGUMENTS`, or the whole app if none is given. Measure before changing anything.

## Checks

1. **Backend calls.** Each input should make exactly one `POST /api/ai/query` and one async `POST /api/ai/embed` per save. If there are duplicates, trace `App.tsx` → `useCommandInterpreter` → `backendService`.
2. **Pipeline timing.** Read the backend `━━━ AI Query Pipeline ━━━` logs. A slow Stage 1 means the feature-embedding cache was missed; this is expected only once after a model switch. A slow Stage 2 means too much history. A slow Stage 3 points to the model choice or prompt size (`commands` mode is ~2000 tokens).
3. **Re-renders.** Service instances belong in `useRef`, handlers in `useCallback`, and Redux selectors should be narrow, never the whole store.
4. **Storage.** Transcription history must stay bounded (embeddings are ~3KB each). Handle `QuotaExceededError` by pruning the oldest entries.
5. **Leaks.** Recognition, microphone and SSE readers must be cleaned up in effect cleanups.

## Report

List each check as ✅ or ⚠️, with the evidence (a log line, a count or a profiler result) and a concrete fix with its file path. Don't propose fixes that would change the routing behaviour without saying so.
