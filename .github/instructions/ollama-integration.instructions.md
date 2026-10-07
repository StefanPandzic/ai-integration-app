---
description: 'Use when working with Ollama integration, AI command interpretation, prompt engineering, or optimizing API calls for voice commands. Covers RAG-based semantic routing, single-call optimization, and contextual AI responses.'
applyTo:
  [
    'backend/src/services/ollamaClient.ts',
    'backend/src/services/queryService.ts',
    'backend/src/services/ragService.ts',
    'backend/src/services/intentRouting.ts',
    'backend/src/services/promptBuilder.ts',
    'backend/src/config/commandRegistry.ts',
    'backend/src/config/appKnowledgeBase.ts',
    'src/features/ai/hooks/useCommandInterpreter.ts',
    'src/features/ai/services/backendService.ts',
    'src/features/ai/services/commandExecutor.ts',
  ]
---

# Ollama Integration Guidelines

## Architecture: Backend Owns All AI Logic

All Ollama API communication, intent routing, RAG retrieval, and prompt building happens in the **Node.js backend** (`backend/src/`). The frontend (`src/`) only:

- Sends text + history (+ optional image) to `POST /api/ai/query` via SSE
- Receives streamed thinking chunks and the final `CommandBatch`
- Executes commands locally via `CommandExecutor`

**There is no `ollamaService.ts` in the frontend.** The backend is the single point of Ollama integration.

## Problem-Solving with Ollama

**Explicit Reasoning for API Optimization**: Think through data flow before implementing

**Common Analysis Patterns**:

1. **Tracing API Calls**:

   ```
   Question: Why is this taking 20 seconds instead of 5?
   Thinking:
   - Check Network tab: How many backend /api/ai/query calls?
   - Backend logs show three pipeline stages
   - Check if feature embeddings were already cached (should be)
   - Verify single Ollama call per query
   ```

2. **Semantic Routing Decisions**:

   ```
   Question: Should "What is theme park?" trigger command mode?
   Thinking:
   - Backend calculates cosine similarity to 'theme' feature embedding
   - "theme park" context different from "app theme"
   - Embedding should show LOW similarity (<0.3)
   - Route to 💬 general mode → No commands in prompt
   ```

3. **Token Efficiency Analysis**:

   ```
   Question: How can we reduce prompt size?
   Thinking:
   - Three-mode routing: general/app-info/commands
   - 💬 general: minimal prompt, no commands, no app context
   - 📚 app-info: app feature description injected, no commands
   - ⚡ commands: full command list for accurate detection
   ```

4. **Batch Command Design**:
   ```
   Question: Should "turn on line 1 and printer 2" be one command or two?
   Thinking:
   - Two actions → Two separate Command objects in the array
   - But one user input → CommandBatch wrapper
   - Frontend executes sequentially via executeBatch()
   - Single aiResponse acknowledging both
   ```

**Performance Reasoning Checklist**:

- [ ] Traced full data flow from frontend input to backend SSE response
- [ ] Verified RAG routing happens BEFORE Ollama call in backend
- [ ] Confirmed single Ollama call per user input
- [ ] Checked feature embeddings are cached (initialized on backend startup)
- [ ] Measured actual response time vs expected (2-10s)

**When Something is Slow**:

```
Thinking:
1. Backend logs: Check ━━━ AI Query Pipeline ━━━ output
2. Stage 1 slow: Feature embedding cache miss? (should be pre-cached on startup)
3. Stage 2 slow: Too many history items for RAG? (top-3 is default)
4. Stage 3 slow: Model choice? (llama3 fastest, gemma4:31b slowest)
5. Verify prompt size in logs: 💬 general (<500 tokens), ⚡ commands (~2000 tokens)
```

## Three-Stage Backend Pipeline

All processing happens in [queryService.ts](../../backend/src/services/queryService.ts).

### Stage 1: Intent Routing (Semantic Routing)

**Purpose**: Route to one of three modes to minimize prompt tokens

**How it works**:

1. Generate query embedding via `callOllamaEmbedApi()` (always uses local `nomic-embed-text`)
2. Compare against cached feature embeddings (8 app features, cached on backend startup)
3. Determine mode based on max similarity and query type:
   - **Low similarity** (below threshold): `💬 general` → minimal prompt, no commands
   - **High similarity + informational intent**: `📚 app-info` → inject matched feature description
   - **High similarity + action intent**: `⚡ commands` → inject full command list

**Threshold**: `INTENT_ROUTING_THRESHOLD = 0.3`; for knowledge questions (`isKnowledgeQuestion()`), threshold is raised by `+0.3` → effective threshold becomes `0.6`.

**Informational intent patterns** ([intentRouting.ts](../../backend/src/services/intentRouting.ts)):

- `tell me about`, `explain`, `describe`, `list`, `show me`, `how many`, `what is`, `what are`
- Detected by `hasInformationalIntent()` — routes to `📚 app-info` when similarity is high

```
Query: "What is theme park?"
  ├─ Embedding similarity to 'theme' feature: ~0.15 (low)
  ├─ isKnowledgeQuestion: true → threshold = 0.6
  └─ 0.15 < 0.6 → 💬 general

Query: "Tell me about production lines"
  ├─ Embedding similarity to 'production-lines' feature: ~0.72 (high)
  ├─ hasInformationalIntent: true
  └─ 📚 app-info (injects production feature description)

Query: "Switch to dark theme"
  ├─ Embedding similarity to 'theme' feature: ~0.78 (high)
  ├─ hasInformationalIntent: false
  └─ ⚡ commands (injects full command list)
```

### Feature Embedding Cache

Feature embeddings are **cached on backend startup** in `featureEmbeddingsCache` (a module-level variable in `queryService.ts`). There is no frontend-side feature embedding generation.

- `initializeFeatureEmbeddings()` — called once on server startup
- `invalidateEmbeddingsCache()` — called when model is switched via `PUT /api/config/model`
- On next query after invalidation, cache is rebuilt automatically

### Stage 2: RAG Context Retrieval

1. `retrieveRelevant(queryEmbedding, transcriptionHistory, 3)` — semantic search over history sent from frontend
2. `formatContext(topItems)` — formats top-3 items, max ~6000 chars
3. Context injected into prompt for all three modes

### Stage 3: Ollama Call + SSE Streaming

1. `buildSystemPrompt(mode, ragContext, appContext, commandList)` — selects mode-specific prompt builder from [promptBuilder.ts](../../backend/src/services/promptBuilder.ts)
2. `callOllamaApiSSE()` — streams response; conditionally enables `think: true` for thinking models, includes image only for `supportsVision` models
3. SSE events streamed to frontend:
   - `event: thinking` → real-time reasoning chunks (DeepSeek-R1, Gemma 4)
   - `event: complete` → final JSON with `response`, `command`/`commandBatch`, `mode`
4. `extractAndParseCommand()` — robust JSON extraction with fallback strategies

## Model Configuration

Models defined in [aiModels.ts](../../backend/src/config/aiModels.ts):

| Model         | Type  | Thinking | Vision |
| ------------- | ----- | -------- | ------ |
| `llama3`      | local | ✗        | ✗      |
| `deepseek-r1` | local | ✓        | ✗      |
| `gemma4:31b`  | cloud | ✓        | ✓      |

- **Embeddings**: Always use local `nomic-embed-text` regardless of active model
- **Vision queries**: `image` field (base64) forwarded to Ollama only when `supportsVision: true`
- **Cloud models**: Require `OLLAMA_API_KEY` in `backend/.env`

## Command Types and Interfaces

Defined in [backend/src/types/index.ts](../../backend/src/types/index.ts):

```typescript
interface Command {
  action: CommandAction; // One of 7 actions or NONE
  parameters?: {
    theme?: 'light' | 'dark';
    language?: string;
    title?: string;
    subtitle?: string;
    lineId?: number;
    printerId?: number;
  };
  interpretation: string;
  aiResponse: string; // Required - contextual natural language response
}

interface CommandBatch {
  commands: Command[]; // Always an array, even for single commands
  interpretation: string;
  aiResponse: string;
}
```

**Note**: The backend always returns a `CommandBatch` (never a bare `Command`). The frontend always handles `CommandBatch`.

## Frontend: Command Execution

### CommandExecutionContext

`CommandExecutionContext` only contains Redux dispatch — **no raw callbacks**:

```typescript
interface CommandExecutionContext {
  dispatch: AppDispatch;
}
```

All state changes go through Redux actions. Individual handler files in `src/features/ai/services/handlers/` dispatch the correct slice actions.

### Handler Registry Pattern

`CommandExecutor` uses a **handler registry** (not a switch statement):

```typescript
// src/features/ai/services/handlerRegistry.ts
export const commandHandlers: Record<CommandAction, CommandHandler> = {
  [CommandAction.TOGGLE_THEME]: themeHandlers.toggleTheme,
  [CommandAction.SET_THEME]: themeHandlers.setTheme,
  // ...
};

// CommandExecutor looks up handler by action
const handler = commandHandlers[command.action];
return handler(command, context);
```

Handler files are organized by domain:

- `handlers/themeHandlers.ts` — theme/appearance
- `handlers/productionHandlers.ts` — production lines + printers
- `handlers/transcriptionHandlers.ts` — clear history
- `handlers/languageHandlers.ts` — speech language
- `handlers/appHandlers.ts` — title/subtitle

### Adding New Commands Workflow

1. Add `CommandAction` enum value in **both** `backend/src/types/index.ts` and `src/features/ai/types/commands.ts`
2. Add command definition to `COMMAND_REGISTRY` in `backend/src/config/commandRegistry.ts`
3. Add feature to `backend/src/config/appKnowledgeBase.ts` if it represents a new feature area
4. Create or update a handler file in `src/features/ai/services/handlers/`
5. Register the handler in `src/features/ai/services/handlerRegistry.ts`
6. No changes to `CommandExecutionContext` needed unless a new Redux slice is required

## SSE Response Handling (Frontend)

`backendService.ts` does **not** track `event:` lines. It differentiates events by inspecting JSON fields on each `data:` line:

```typescript
// Thinking chunk
if (parsed.text) onThinking(parsed.text);

// Complete response
if (parsed.response) onComplete(parsed);

// Error
if (parsed.error) onError(parsed.error);
```

## Prompt Engineering

Three mode-specific prompts in [promptBuilder.ts](../../backend/src/services/promptBuilder.ts):

| Mode          | Prompt content                                     | Token cost   |
| ------------- | -------------------------------------------------- | ------------ |
| `💬 general`  | Basic assistant instructions                       | ~200 tokens  |
| `📚 app-info` | + matched feature description                      | ~400 tokens  |
| `⚡ commands` | + full command list from `generateCommandPrompt()` | ~2000 tokens |

All modes use the same JSON output structure:

```json
{
  "commands": [
    { "action": "NONE", "parameters": null, "interpretation": "..." }
  ],
  "interpretation": "...",
  "aiResponse": "Natural language response here"
}
```

### Response Guidelines

**For Commands** (`action !== NONE`):

- Acknowledge the action: "Switched to dark mode!"
- For production: "Line 1 is now active!"
- For batch: "Done! Line 1 is active and printer 2 is enabled."

**For Regular Text** (`action === NONE`):

- Conversational response: "That's interesting!"
- Context-aware: Use RAG context if relevant

## Command Registry Pattern

Defined in `backend/src/config/commandRegistry.ts`. `generateCommandPrompt()` builds the string injected into `⚡ commands` mode prompts.

**Note**: Category-based filtering is **not used** for token reduction. Token savings come from the three-mode routing decision, not from filtering by category.

## Implementation Checklist

When modifying Ollama integration:

- [ ] All Ollama API logic stays in the backend (`backend/src/services/`)
- [ ] Single Ollama call per user input (check backend logs)
- [ ] Feature embeddings cached on startup, invalidated on model switch
- [ ] `Command` interface includes `aiResponse` field (required)
- [ ] Commands always returned as `CommandBatch` (array)
- [ ] `CommandExecutionContext` only has `dispatch: AppDispatch`
- [ ] New commands registered in both backend types and frontend handler registry
- [ ] Vision images forwarded only when model `supportsVision: true`
- [ ] Error cases return valid `aiResponse` strings

## Flow Pattern

```
Frontend: User Input (text + history + optional image)
    ↓
POST /api/ai/query  (SSE)
    ↓
Backend: queryService.processQuery()
    ├─ STAGE 1: Intent Routing
    │   ├─ Generate query embedding (nomic-embed-text, always local)
    │   ├─ Compare against featureEmbeddingsCache (8 features)
    │   ├─ isKnowledgeQuestion() → threshold +0.3 if true
    │   ├─ maxSimilarity < threshold → 💬 general
    │   ├─ maxSimilarity >= threshold + hasInformationalIntent → 📚 app-info
    │   └─ maxSimilarity >= threshold + action intent → ⚡ commands
    │
    ├─ STAGE 2: RAG Context Retrieval
    │   └─ retrieveRelevant() → top-3 semantically similar history items
    │
    └─ STAGE 3: Ollama Call + SSE Streaming
        ├─ buildSystemPrompt(mode, ragContext, appContext, commandList)
        ├─ callOllamaApiSSE() → stream thinking chunks (event: thinking)
        ├─ extractAndParseCommand() → CommandBatch
        └─ stream final result (event: complete)
    ↓
Frontend: handleSSEResponse() → CommandBatch
    ↓
CommandExecutor.executeBatch() → handler registry → Redux dispatch
    ↓
Save Transcription with aiResponse
```

## Batch Command Processing

**What it is**: Multiple commands from a single natural language input

**Example**: "Turn on line 1 and enable printer 2"

**Flow**:

1. Backend routes to `⚡ commands` mode
2. Ollama returns JSON with two entries in `commands` array
3. `extractAndParseCommand()` parses into `CommandBatch`
4. Frontend `executeBatch()` runs handlers sequentially
5. Single `aiResponse` acknowledges both actions

## Testing Verification

When testing changes:

1. **Semantic Routing**: Backend logs show `━━━ AI Query Pipeline ━━━` with mode decision
2. **Similarity Scores**: Check `Max similarity: X.XXX (threshold: X.XXX)` in backend logs
3. **Feature Embeddings**: Verify `✅ Feature embeddings cached (8 features, Xs)` on startup
4. **Network Tab**: Only ONE `POST /api/ai/query` SSE call per user input
5. **Token Efficiency**: Mode shown in `event: complete` response field
   - `💬 general`: minimal prompt
   - `📚 app-info`: feature description injected
   - `⚡ commands`: full command list
6. **Command Test**: "toggle theme" → high similarity → `⚡ commands` → `TOGGLE_THEME`
7. **General Test**: "nice weather" → low similarity → `💬 general` → `NONE`
8. **Question Test**: "What is theme?" → threshold boosted to 0.6 → likely `💬 general`
9. **App Info Test**: "Tell me about production lines" → high similarity + informational → `📚 app-info`
10. **Batch Test**: "Turn on line 1 and enable printer 2" → `⚡ commands` → two commands execute
11. **Vision Test**: Attach image → only forwarded if active model has `supportsVision: true`
12. **Performance**: Expect 2-10s total response time
