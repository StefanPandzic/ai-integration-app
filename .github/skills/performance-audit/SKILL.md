---
name: performance-audit
description: 'Audit the speech-to-text app for performance issues. Use when investigating slow responses, multiple backend calls, unnecessary re-renders, or Redux Persist bottlenecks.'
argument-hint: 'component or service to audit'
---

# Performance Audit

Comprehensive performance audit for the speech-to-text application, focusing on common React, Redux, and backend API optimization patterns.

## Architecture Context

- **All Ollama communication** goes through the Node.js backend (`POST /api/ai/query` SSE)
- **Feature embeddings** are cached on backend startup — slow first response after model switch is expected
- **Transcription embeddings** are generated async via `POST /api/ai/embed` after each save
- **State management** uses Redux Toolkit + Redux Persist (transcriptions, production state, app state)
- **No direct Ollama calls from the frontend** — if you see them, something is wrong

## Reasoning Framework

**Systematic Performance Analysis**: Think through bottlenecks methodically

**Investigation Pattern**:

1. **Measure First**:

   ```
   Thinking:
   - What is the actual response time? (Network tab)
   - How many POST /api/ai/query calls are made? (should be exactly 1)
   - How many POST /api/ai/embed calls? (1 per saved transcription, async)
   - How many re-renders occur? (React DevTools Profiler)
   - What is Redux Persist storage size? (Application → localStorage)
   ```

2. **Identify Root Cause**:

   ```
   Thinking:
   - If 2+ /api/ai/query calls: Trace from input → interpretAndExecute
   - If first query after model switch is slow: Feature embedding cache rebuild (~6s, expected)
   - If every query is slow: Check backend logs for Stage 1/2/3 timing
   - If excessive re-renders: Check useState vs useRef for services
   - If Redux Persist error: Check transcription history size
   ```

3. **Validate Solution**:
   ```
   Thinking:
   - Will this fix break RAG routing or command detection?
   - Will Redux state updates trigger cascading re-renders?
   - Does the fix affect SSE streaming behavior?
   - Can we test the fix in isolation?
   ```

**Example Analysis Session**:

```
Issue: Save operation takes 15 seconds

Thinking:
1. Expected: 2-10s (reasonable for Ollama)
2. Measure: Network tab shows TWO POST /api/ai/query calls
3. Root cause: interpretAndExecute called twice from App.tsx
4. Trace: handlers/saveTranscriptionHandler.ts → duplicate call
5. Fix: Ensure single call path through useCommandInterpreter
6. Validate: Verify one SSE call in Network tab + backend ━━━ AI Query Pipeline ━━━ logged once
7. Result: 5s response time (50% improvement)
```

## When to Use

- App feels slow or unresponsive
- Investigating why processing takes too long
- Suspecting multiple redundant backend SSE calls
- Debugging unnecessary component re-renders
- Redux Persist / localStorage causing delays
- Feature embedding rebuild happening too frequently

## Audit Procedure

### 1. Backend API Call Analysis

**Objective**: Ensure exactly one `POST /api/ai/query` call per user input

Check [src/features/ai/hooks/useCommandInterpreter.ts](../../src/features/ai/hooks/useCommandInterpreter.ts):

- [ ] `interpretAndExecute` is called once per user action
- [ ] No parallel or duplicate SSE calls for the same text
- [ ] `handleSSEResponse` used (not raw fetch)

Check [src/handlers/saveTranscriptionHandler.ts](../../src/handlers/saveTranscriptionHandler.ts):

- [ ] Only one call to `interpretAndExecute` in the save flow
- [ ] AI response from SSE result is passed through, not regenerated

Check [src/features/ai/services/backendService.ts](../../src/features/ai/services/backendService.ts):

- [ ] SSE connection closed after `event: complete`
- [ ] Error handling does not trigger retry loops

**Red Flags**:

- Multiple `POST /api/ai/query` calls visible in Network tab
- Backend logs show `━━━ AI Query Pipeline ━━━` more than once per user input
- `backendServiceRef.current.queryWithStreaming()` called from multiple places

### 2. Backend Pipeline Timing

**Objective**: Identify slow stages in the three-stage backend pipeline

Read **backend console logs** for each query:

```
━━━ AI Query Pipeline ━━━
📥 Input: "..."

📍 STAGE 1: Intent Routing
  ├─ Query embedding generated (768D)     ← should be ~100-500ms
  └─ Routed to: ⚡ commands               ← mode logged here

📚 STAGE 2: RAG Context Retrieval         ← should be <50ms (cosine calc only)

🤖 STAGE 3: Ollama Call                   ← 2-10s depending on model
```

**Expected Benchmarks**:

| Stage                         | Expected Time | Red Flag                 |
| ----------------------------- | ------------- | ------------------------ |
| Stage 1 (embedding + routing) | 100-500ms     | >2s every query          |
| Stage 2 (RAG retrieval)       | <50ms         | >500ms                   |
| Stage 3 (Ollama call)         | 2-10s         | >20s                     |
| Feature embedding rebuild     | ~6s one-time  | Happening on every query |

**Feature Embedding Cache**:

- Should initialize once on backend startup: `✅ Feature embeddings cached (8 features, Xs)`
- Rebuilds after `PUT /api/config/model` — one slow query after model switch is expected
- If rebuilding on every query: check `invalidateEmbeddingsCache()` is not being called unnecessarily

### 3. Re-render Analysis

**Objective**: Minimize unnecessary component updates

Check hook patterns in `src/features/*/hooks/`:

- [ ] Service instances (`BackendService`, `CommandExecutor`) stored in `useRef`, not `useState`
- [ ] Event handlers wrapped in `useCallback`
- [ ] Redux selectors are specific (not selecting the entire store)
- [ ] `useAppSelector` selectors return stable references where possible

Check component patterns:

- [ ] Props interfaces defined with TypeScript
- [ ] No inline function definitions in JSX
- [ ] Stable references for callback props
- [ ] `React.memo` used for expensive pure components

**Red Flags**:

- `BackendService()` or `CommandExecutor()` called in component render (should be in `useRef`)
- `useAppSelector(state => state)` selecting entire store
- Inline arrow functions in JSX: `onClick={() => handle()}`
- Redux dispatch called in a tight loop

### 4. Redux Persist / Storage Performance

**Objective**: Efficient persistence without blocking UI

Check Redux Persist configuration in [src/store/index.ts](../../src/store/index.ts):

- [ ] Only necessary slices are persisted (transcription history, not transient UI state)
- [ ] Transcription history does not grow unbounded
- [ ] Embedded vectors (`embedding` field on transcriptions) are stored efficiently

**Optimization Recommendations**:

- Keep transcription history bounded (consider pruning old items)
- Embeddings are `number[]` (~3KB each) — 100 transcriptions = ~300KB, which is acceptable
- If `QuotaExceededError`: prune oldest transcriptions or omit embeddings from persisted state

**Red Flags**:

- `QuotaExceededError` in browser console
- Redux Persist rehydration taking >1s on page load
- `transcriptionSlice` storing non-serializable values

### 5. Async Embedding Generation

**Objective**: Ensure transcription embedding generation never blocks the UI

Check the save flow in [src/handlers/saveTranscriptionHandler.ts](../../src/handlers/saveTranscriptionHandler.ts):

- [ ] Transcription is saved to Redux **before** calling `POST /api/ai/embed`
- [ ] Embedding generation is `await`ed only after the save is confirmed
- [ ] Errors in embedding generation are caught and logged — they must not surface to the user
- [ ] Query embedding from Stage 1 is **not** duplicated in Stage 2 (backend handles this internally)

**Red Flags**:

- UI waits for `generateEmbeddings()` before showing the saved transcription
- `backendService.generateEmbeddings()` called synchronously in the save path
- Backend Stage 2 logs a new embedding API call (it should reuse the Stage 1 embedding)

## Common Issues and Fixes

### Issue: Multiple Backend SSE Calls

**Symptoms**:

- Processing takes 10-20 seconds instead of 5-10 seconds
- Network tab shows 2+ `POST /api/ai/query` calls
- Backend logs show `━━━ AI Query Pipeline ━━━` twice

**Fix**:

- Trace which code path calls `interpretAndExecute` and eliminate duplicate call
- Ensure `saveTranscriptionHandler.ts` calls `interpretAndExecute` exactly once
- Check no `useEffect` is re-triggering the call due to a dependency change

### Issue: Feature Embeddings Rebuilt Every Query

**Symptoms**:

- Every query takes 6-10s (not just the first one)
- Backend logs show `🔄 Generating feature embeddings...` on every request

**Fix**:

- `featureEmbeddingsCache` in `queryService.ts` should be `null` only before first init
- Check `invalidateEmbeddingsCache()` is only called from `PUT /api/config/model` handler
- Verify `initializeFeatureEmbeddings()` is called during server startup in `backend/src/index.ts`

### Issue: Excessive Re-renders

**Symptoms**:

- UI feels sluggish
- React DevTools Profiler shows repeated renders on unrelated state changes

**Fix**:

- Move `BackendService()` and `CommandExecutor()` factory calls into `useRef`
- Use specific Redux selectors: `useAppSelector(state => state.transcription.items)` not `state`
- Wrap event handlers in `useCallback` with correct dependencies

### Issue: Redux Persist Bottleneck

**Symptoms**:

- Page load is slow (rehydration)
- Browser console shows `QuotaExceededError`

**Fix**:

- Add a maximum transcription count limit in `transcriptionSlice`
- Consider blacklisting the `embedding` field from Redux Persist to save space
- Use Redux Persist's `transforms` to strip embeddings before storing

### Issue: Memory Leaks

**Symptoms**:

- App slows down over time
- Memory usage grows continuously

**Fix**:

- Ensure SSE connections are closed in `backendService.ts` after `event: complete` or `event: error`
- Clean up `EventSource` instances on component unmount
- Clear pending abort controllers in `useEffect` cleanup

## Performance Testing Checklist

- [ ] **Single Backend Call**: Only 1 `POST /api/ai/query` per user input (Network tab)
- [ ] **Response Time**: <10 seconds for typical inputs (backend logs)
- [ ] **Feature Embeddings**: Cached on startup, not rebuilt per query
- [ ] **Embedding Generation**: Async, does not block save confirmation
- [ ] **Re-render Count**: Minimal re-renders (React DevTools Profiler)
- [ ] **Redux Persist Size**: Transcription history bounded, no `QuotaExceededError`
- [ ] **Memory Stable**: SSE connections closed, no leaks after extended use
- [ ] **Error Handling**: Graceful degradation when backend is unreachable

## Reporting Findings

Document issues found with:

1. **Location**: File and line number
2. **Issue**: What's wrong
3. **Impact**: Performance cost (time/renders/memory)
4. **Fix**: Recommended solution with code example
5. **Priority**: High/Medium/Low based on user impact

## Example Audit Report

```
## Performance Audit Results

### Backend API Calls ✅
- Single POST /api/ai/query per save operation verified
- Response time: 5.2s average (Stage 3 dominant)
- Feature embeddings cached on startup, not rebuilt

### Re-renders ⚠️
- ConversationHistory re-renders on every Redux update
- Fix: Use specific selector for conversation items only
- Expected improvement: 60% fewer renders

### localStorage ✅
- History size limited to 100 items
- Save operations async and error-handled
- No bottlenecks detected
```
