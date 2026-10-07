---
paths:
  - 'backend/src/**/*.ts'
  - 'src/features/ai/**/*.ts'
---

# AI Pipeline Rules

`queryService.processQuery()` runs three stages per request:

1. **Intent routing.** Embed the query (always local `nomic-embed-text`) and compare it with cosine similarity against the cached `APP_FEATURES` embeddings. The threshold is `INTENT_ROUTING_THRESHOLD` (0.3), raised by 0.3 when `isKnowledgeQuestion()` matches. Below the threshold → `general`. At or above it with `hasInformationalIntent()` → `app-info`. Otherwise → `commands`.
2. **RAG.** Run `retrieveRelevant()` to get the top 3 history items, reusing the Stage 1 query embedding (never embed twice). `formatContext()` caps the result at ~6000 chars.
3. **LLM call.** `buildSystemPrompt(mode, ...)` → `callOllamaApiSSE()` streams `event: thinking`, then `extractAndParseCommand()` → `event: complete`.

## Invariants

- Exactly **one** LLM call per user input.
- Feature embeddings are cached at startup; `PUT /api/config/model` invalidates and rebuilds them.
- The backend always returns a `CommandBatch` (array), and every command has an `aiResponse`.
- Send `think: true` only when `supportsThinking` is set, and forward images only when `supportsVision` is set (see `aiModels.ts`).
- Only items with a non-empty `embedding` take part in RAG. Embedding generation after a save is async and must never block the save.
- `CommandExecutionContext` is `{ dispatch }` only. Handlers change state through Redux actions.
- A `CommandAction` enum change must be made in **both** `backend/src/types/index.ts` and `src/features/ai/types/commands.ts`.

## Debugging

Read the backend's `━━━ AI Query Pipeline ━━━` log block, which shows the max similarity, the effective threshold and the chosen mode. If routing is wrong, improve the feature descriptions in `appKnowledgeBase.ts` rather than tuning the thresholds.
