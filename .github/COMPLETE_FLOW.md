# Complete Application Flow: From User Input to AI Response

**Last Updated**: May 26, 2026  
**Purpose**: Detailed step-by-step walkthrough of the entire data flow from when a user enters text until the AI responds and embeddings are generated.

---

## Table of Contents

1. [Overview](#overview)
2. [Initial Setup (Backend Startup)](#initial-setup-backend-startup)
3. [Main Flow: User Saves Text](#main-flow-user-saves-text)
4. [Flow Variants by Query Type](#flow-variants-by-query-type)
5. [Async Operations](#async-operations)
6. [Complete Code Path](#complete-code-path)

---

## Overview

### Architecture Summary

```
Frontend                                        Backend (Node.js)
────────                                        ─────────────────
User Input → Save to Redux
           → POST /api/ai/query (SSE)  ───→    Stage 1: Intent Routing (embedding + cosine)
                                                Stage 2: RAG Context Retrieval (top-3)
           ← SSE: event: thinking      ←───    Stage 3: Ollama Call (streaming)
           ← SSE: event: complete      ←───
Command Execution (Redux dispatch)
Embedding Generation (async)  ─────────→       POST /api/ai/embed
```

### Key Components

**Backend** (`backend/src/`):

- **queryService.ts** — Main pipeline orchestrator (3 stages)
- **intentRouting.ts** — Question detection, threshold adjustment, informational patterns
- **ragService.ts** — Cosine similarity, top-k retrieval, context formatting
- **promptBuilder.ts** — Three mode-specific prompt builders (general/app-info/commands)
- **ollamaClient.ts** — Ollama API call with SSE streaming + thinking support
- **embedClient.ts** — Embedding generation (always local nomic-embed-text)
- **jsonParser.ts** — Robust JSON extraction from LLM output

**Frontend** (`src/`):

- **App.tsx** — Main orchestrator, Redux state, save flow
- **useCommandInterpreter.ts** — Sends to backend SSE, receives CommandBatch
- **backendService.ts** — SSE client (queryWithStreaming, generateEmbeddings)
- **commandExecutor.ts** — Handler registry lookup + executeBatch
- **handlerRegistry.ts** — Maps CommandAction → handler function
- **handlers/\*.ts** — Individual handlers that dispatch Redux actions

---

## Initial Setup (Backend Startup)

### Step 0: Feature Embedding Pre-generation

**When**: Once on backend server startup  
**Where**: `backend/src/services/queryService.ts` → `initializeFeatureEmbeddings()`  
**Duration**: ~5-10 seconds (one-time cost)

```typescript
export const initializeFeatureEmbeddings = async (): Promise<void> => {
  console.log('🔄 Generating feature embeddings...');
  const config = getOllamaConfig();

  const embeddings: number[][] = [];
  for (const feature of APP_FEATURES) {
    // Call local Ollama embeddings API for each of 8 features
    const embedding = await callOllamaEmbedApi(config, feature.description);
    embeddings.push(embedding);
  }

  featureEmbeddingsCache = embeddings;
  console.log(
    `✅ Feature embeddings cached (${embeddings.length} features, Xs)`,
  );
};
```

**Result**: 8 feature embeddings stored in `featureEmbeddingsCache` (module-level variable), reused for all queries until model switch.

**Cache Invalidation**: `PUT /api/config/model` → `invalidateEmbeddingsCache()` → rebuilt on next query.

---

## Main Flow: User Saves Text

### User Actions

1. User types text in editor: `"Turn on production line 1"`
2. User clicks **"Save & Process"** button (or presses Enter)

---

### PHASE 1: Save to Redux + Send to Backend (Frontend)

**File**: `src/handlers/saveTranscriptionHandler.ts` + `src/App.tsx`

#### Step 1.1: Dispatch Save to Redux

```typescript
// Save transcription to Redux store (Redux Persist syncs to localStorage)
dispatch(
  addTranscription({
    id: Date.now().toString(),
    text: 'Turn on production line 1',
    timestamp: Date.now(),
    aiResponse: undefined, // Not yet generated
    embedding: undefined, // Not yet generated
  }),
);
```

**UI Update**:

- Text appears in conversation history immediately
- Shows loading/processing indicator

#### Step 1.2: Call interpretAndExecute

**File**: `src/features/ai/hooks/useCommandInterpreter.ts`

```typescript
const { commandBatch, error } = await handleSSEResponse(
  backendServiceRef.current,
  text,
  history || [],
  image, // Optional image for vision models
  onThinking, // Callback for real-time thinking chunks
  onComplete, // Callback when processing finishes
);
```

This opens a `POST /api/ai/query` SSE connection to the backend.

---

### PHASE 2: Backend Three-Stage Pipeline

**File**: `backend/src/services/queryService.ts` → `processQuery()`

The backend receives the request and logs:

```
━━━ AI Query Pipeline ━━━
📥 Input: "Turn on production line 1"
```

#### Stage 1: Intent Routing

**File**: `backend/src/services/queryService.ts`

##### Step 2.1: Generate Query Embedding

```typescript
const queryEmbedding = await callOllamaEmbedApi(config, text);
// Result: [0.234, -0.567, 0.890, ...] (768 dimensions)
```

**API Call** (always local, regardless of active model):

```
POST http://localhost:11434/api/embeddings
{
  "model": "nomic-embed-text",
  "prompt": "Turn on production line 1"
}
```

##### Step 2.2: Calculate Semantic Similarity

```typescript
// Compare query embedding against cached feature embeddings (8 features)
const similarities = featureEmbeddingsCache!.map((featureEmbed, idx) => ({
  feature: APP_FEATURES[idx],
  score: cosineSimilarity(queryEmbedding, featureEmbed),
}));

const maxSimilarity = Math.max(...similarities.map((s) => s.score));
// Results:
// - 'production-lines': 0.82 ← HIGHEST
// - 'theme': 0.15
// - 'transcription': 0.21
// - 'printers': 0.45
// - ... (8 features total)
```

##### Step 2.3: Apply Routing Decision

```typescript
const isQuestion = isKnowledgeQuestion(text); // FALSE (no "what", "how", etc.)
const threshold = adjustThreshold(INTENT_ROUTING_THRESHOLD, isQuestion);
// adjustThreshold(0.3, false) → 0.3 (no adjustment for non-questions)

if (maxSimilarity < threshold) {
  mode = '💬 general'; // Low similarity → general Q&A
} else if (hasInformationalIntent(text)) {
  mode = '📚 app-info'; // High similarity + informational → app questions
} else {
  mode = '⚡ commands'; // High similarity + action → commands
}
// 0.82 >= 0.3 → above threshold
// hasInformationalIntent("Turn on production line 1") → FALSE
// Decision: ⚡ commands
```

**Backend log**:

```
📍 STAGE 1: Intent Routing
  ├─ Query embedding generated (768D)
  ├─ Max similarity: 0.820 (threshold: 0.300)
  ├─ Is question: false
  └─ Routed to: ⚡ commands (action intent)
```

#### Stage 2: RAG Context Retrieval

**File**: `backend/src/services/ragService.ts`

```typescript
// Filter history items that have embeddings
const withEmbeddings = transcriptionHistory.filter(
  (t) => t.embedding?.length > 0,
);

// Calculate cosine similarity of query embedding to each history embedding
const scored = withEmbeddings.map((t) => ({
  transcription: t,
  score: cosineSimilarity(queryEmbedding, t.embedding!),
}));

// Take top-3 most relevant
const topK = scored.sort((a, b) => b.score - a.score).slice(0, 3);
const context = formatContext(topK); // Max ~6000 chars
```

**Backend log**:

```
📚 STAGE 2: RAG Context Retrieval
  └─ Retrieved 3 relevant history items
```

**Note**: Query embedding from Stage 1 is **reused** — no second embedding API call.

#### Stage 3: Ollama Call + SSE Streaming

**File**: `backend/src/services/ollamaClient.ts` → `callOllamaApiSSE()`

##### Step 3.1: Build System Prompt

```typescript
// buildSystemPrompt() selects the mode-specific prompt builder:
// ⚡ commands mode → buildCommandsPrompt(generateCommandPrompt())
// Injects RAG context and command list
```

**Token Estimate** (⚡ commands mode with history):

- System prompt + command list: ~700 tokens
- RAG context: ~1500 tokens
- User input: ~7 tokens
- **Total prompt**: ~2207 tokens

##### Step 3.2: Call Ollama API (Streaming)

```typescript
// Uses chat API format with streaming
POST http://localhost:11434/api/chat
{
  "model": "llama3:latest",
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user", "content": "Turn on production line 1" }
  ],
  "stream": true
}
```

For thinking-capable models (deepseek-r1, gemma4:31b), adds `"think": true` to the request. For vision-capable models with an attached image, adds `"images": ["<base64>"]` to the user message.

##### Step 3.3: Stream SSE Events to Frontend

```typescript
// Stream thinking chunks (for reasoning models)
res.write(
  `event: thinking\ndata: ${JSON.stringify({ text: thinkingChunk })}\n\n`,
);

// After Ollama completes, parse response and send final result
res.write(
  `event: complete\ndata: ${JSON.stringify({
    response: aiResponse,
    command: commandBatch,
    mode: '⚡ commands',
  })}\n\n`,
);
```

##### Step 3.4: Parse Response (Backend)

**File**: `backend/src/services/jsonParser.ts` → `extractAndParseCommand()`

```typescript
// Robust JSON extraction with fallback strategies:
// 1. Direct JSON.parse
// 2. Extract from markdown code blocks
// 3. Regex extraction of JSON objects
// 4. Normalize common LLM formatting issues

const result = {
  commands: [
    {
      action: 'TOGGLE_PRODUCTION_LINE',
      parameters: { lineId: 1 },
      interpretation: 'User wants to activate production line 1',
      aiResponse: 'Production line 1 is now active!',
    },
  ],
  interpretation: 'User wants to activate production line 1',
  aiResponse: 'Production line 1 is now active!',
};
```

---

### PHASE 3: Frontend Receives SSE Response

**File**: `src/features/ai/utils/sseResponseHandler.ts` → `handleSSEResponse()`

```typescript
// backendService.ts parses each SSE data line as JSON:
// - If parsed.text → thinking chunk → update ThinkingPanel
// - If parsed.response → complete → extract CommandBatch
// - If parsed.error → error → surface to user
```

**UI Update during streaming**:

- ThinkingPanel shows real-time reasoning (for DeepSeek-R1, Gemma 4)
- Progress indicator shows "🧠 AI Reasoning" → "Processing complete"

---

### PHASE 4: Command Execution (Frontend)

**File**: `src/features/ai/services/commandExecutor.ts`  
**Skip if**: All commands have action `NONE`

```typescript
// CommandExecutor uses handler registry (not a switch statement)
const handler = commandHandlers[command.action];
// handler = productionHandlers.toggleProductionLine

return handler(command, context);
// context = { dispatch: AppDispatch }
```

**File**: `src/features/ai/services/handlers/productionHandlers.ts`

```typescript
export const toggleProductionLine = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const lineId = command.parameters?.lineId;
  context.dispatch(toggleLine(lineId)); // Redux action → productionSlice
  return {
    success: true,
    message: `Toggled production line ${lineId}`,
    command,
  };
};
```

**UI Update**:

- Production line 1 indicator changes from OFF to ON
- Redux state update triggers component re-render
- Immediate visual feedback

---

### PHASE 5: Update Transcription with AI Response

**File**: `src/handlers/saveTranscriptionHandler.ts` or App.tsx flow

```typescript
// Update the saved transcription with the AI response
dispatch(
  updateTranscription({
    id: transcriptionId,
    changes: {
      aiResponse: commandBatch.aiResponse, // "Production line 1 is now active!"
    },
  }),
);
```

**UI Update**:

- Loading indicator disappears
- AI response appears in conversation history
- User sees: "Production line 1 is now active!"

---

### PHASE 6: Generate Embedding (Async, Non-Blocking)

**Important**: This happens **AFTER** the user sees the AI response.

**File**: `src/features/ai/services/backendService.ts` → `generateEmbeddings()`

```typescript
// Call backend to generate embedding for the new transcription
const { embeddings } = await backendService.generateEmbeddings([
  'Turn on production line 1',
]);
// Backend calls local Ollama: POST http://localhost:11434/api/embeddings

// Update transcription in Redux with embedding
dispatch(
  updateTranscription({
    id: transcriptionId,
    changes: { embedding: embeddings[0] }, // 768-D vector
  }),
);
```

**Backend endpoint**: `POST /api/ai/embed`

```
Request: { "texts": ["Turn on production line 1"] }
Response: { "embeddings": [[0.234, -0.567, ...]] }
```

**Result**:

- Transcription now has embedding vector
- Future queries can use this for RAG context retrieval (Stage 2)
- No UI change (happens silently in background)

---

## Flow Variants by Query Type

### Case 1: 💬 General Knowledge Question

**Example**: `"What is theme park?"`

**Stage 1 - Routing**:

```
isKnowledgeQuestion("What is theme park?") → TRUE
adjustThreshold(0.3, true) → 0.6

Max similarity to features: 0.15 (theme feature)
0.15 < 0.6 → 💬 general
```

**Stage 3 - Prompt**: `buildGeneralQuestionsPrompt()` — no commands, no app context (~200 tokens)

**Response**:

```json
{
  "commands": [
    {
      "action": "NONE",
      "parameters": null,
      "interpretation": "General question"
    }
  ],
  "aiResponse": "A theme park is an amusement park with themed attractions..."
}
```

**Command Execution**: SKIPPED (action is NONE)

---

### Case 2: 📚 App-Related Question

**Example**: `"Tell me about production lines"`

**Stage 1 - Routing**:

```
isKnowledgeQuestion("Tell me about production lines") → FALSE (doesn't start with what/how/why)
adjustThreshold(0.3, false) → 0.3

Max similarity: 0.72 (production-lines feature)
0.72 >= 0.3 → above threshold
hasInformationalIntent("Tell me about production lines") → TRUE ("tell me about")
→ 📚 app-info
```

**Stage 3 - Prompt**: `buildAppQuestionsPrompt()` + inject matched feature description (~400 tokens)

**Response**:

```json
{
  "commands": [
    {
      "action": "NONE",
      "parameters": null,
      "interpretation": "App feature question"
    }
  ],
  "aiResponse": "This app controls 3 production lines for factory monitoring. You can turn lines on/off using voice commands..."
}
```

---

### Case 3: ⚡ Batch Command

**Example**: `"Turn on line 1 and enable printer 2"`

**Stage 1**: High similarity + no informational intent → `⚡ commands`

**Stage 3 - LLM Response**:

```json
{
  "commands": [
    {
      "action": "TOGGLE_PRODUCTION_LINE",
      "parameters": { "lineId": 1 },
      "interpretation": "Activate line 1",
      "aiResponse": "Line 1 activated!"
    },
    {
      "action": "TOGGLE_PRINTER",
      "parameters": { "printerId": 2 },
      "interpretation": "Enable printer 2",
      "aiResponse": "Printer 2 enabled!"
    }
  ],
  "interpretation": "User wants to activate line 1 and enable printer 2",
  "aiResponse": "Done! Line 1 is active and printer 2 is enabled."
}
```

**Command Execution**:

```typescript
// executeBatch() runs each handler sequentially
commandHandlers[CommandAction.TOGGLE_PRODUCTION_LINE](commands[0], context); // → dispatch(toggleLine(1))
commandHandlers[CommandAction.TOGGLE_PRINTER](commands[1], context); // → dispatch(togglePrinter(2))
```

**UI Update**: Both production line 1 and printer 2 indicators turn ON.

---

### Case 4: Follow-up Question (RAG Context)

**Example**: `"What did I say about line 1?"`

**Stage 1**: Question → threshold 0.6; similarity to production: ~0.68 → 0.68 >= 0.6 → above threshold. `hasInformationalIntent("What did I say about line 1?")` → TRUE ("what is/what are" patterns). Routed to `📚 app-info`.

**Stage 2** (RAG Context): Top-3 history items about "line 1" retrieved and formatted into context.

**Stage 3**: LLM sees relevant conversation history, provides contextual answer without executing commands.

---

### Case 5: Vision Query (Image Attached)

**Example**: Text `"What is in this image?"` + attached image

**Frontend**: Sends `image` field (base64) in request body.

**Backend Stage 3**: `callOllamaApiSSE()` checks `getModelFeatures()`:

- If model `supportsVision: true` (gemma4:31b) → includes `images: [base64]` in the chat message
- If model `supportsVision: false` (llama3, deepseek-r1) → image is silently dropped

---

## Async Operations

### Sequential Operations (Blocking, User Waits)

1. **Save to Redux** (immediate, ~1ms)
2. **SSE request to backend** (network, ~10ms)
3. **Backend Stage 1: Embedding + Routing** (~100-500ms)
4. **Backend Stage 2: RAG Retrieval** (<50ms, cosine calc only)
5. **Backend Stage 3: Ollama LLM Call** (~2-10s depending on model)
6. **Frontend: Command Execution** (immediate, ~1ms)
7. **Frontend: Update Redux with aiResponse** (immediate, ~1ms)

**User sees response after**: Steps 1-7 (~2-10s total)

### Non-Blocking (After User Sees Response)

8. **Embedding generation** (`POST /api/ai/embed` → ~500-1000ms)

---

## Complete Code Path

### File Execution Order

```
Frontend:
1. App.tsx / saveTranscriptionHandler.ts
   └─ dispatch(addTranscription(...))                    [Redux]
   └─ useCommandInterpreter.ts → interpretAndExecute()
       └─ sseResponseHandler.ts → handleSSEResponse()
           └─ backendService.ts → queryWithStreaming()   [SSE to backend]

Backend (POST /api/ai/query):
2. index.ts → route handler
   └─ queryService.ts → processQuery()
       │
       ├─ embedClient.ts → callOllamaEmbedApi()        [Ollama embed API]
       ├─ cosineSimilarity() against featureEmbeddingsCache
       ├─ intentRouting.ts → isKnowledgeQuestion(), adjustThreshold(), hasInformationalIntent()
       │   └─ Routing decision: 💬 / 📚 / ⚡
       │
       ├─ ragService.ts → retrieveRelevant()           [top-3 cosine search]
       │   └─ formatContext()                           [max 6000 chars]
       │
       ├─ promptBuilder.ts → buildSystemPrompt()        [mode-specific prompt]
       ├─ ollamaClient.ts → callOllamaApiSSE()         [Ollama chat API, streaming]
       │   └─ SSE: event: thinking (streamed to frontend)
       │   └─ SSE: event: complete (final response)
       │
       └─ jsonParser.ts → extractAndParseCommand()      [robust JSON extraction]

Frontend (receives SSE events):
3. sseResponseHandler.ts
   └─ thinking chunks → dispatch to ThinkingPanel UI
   └─ complete → CommandBatch received

4. useCommandInterpreter.ts
   └─ commandExecutor.ts → executeBatch()
       └─ handlerRegistry.ts → commandHandlers[action]
           └─ handlers/productionHandlers.ts            [dispatch Redux action]

5. dispatch(updateTranscription({ aiResponse }))        [Redux]

6. backendService.ts → generateEmbeddings()             [ASYNC, non-blocking]
   └─ Backend: embedClient.ts → callOllamaEmbedApi()
   └─ dispatch(updateTranscription({ embedding }))      [Redux]
```

### API Calls Summary

For a typical command query:

| #   | Endpoint                           | Purpose                         | Timing               |
| --- | ---------------------------------- | ------------------------------- | -------------------- |
| 1   | Backend → Ollama `/api/embeddings` | Query embedding (Stage 1)       | ~100-500ms           |
| 2   | Backend → Ollama `/api/chat`       | LLM generation (Stage 3)        | ~2-10s               |
| 3   | `POST /api/ai/embed`               | Transcription embedding (async) | ~500ms, non-blocking |

**Frontend-to-backend calls**: 1 SSE + 1 async embed = 2  
**Backend-to-Ollama calls**: 1 embed + 1 chat = 2 (+ 1 async embed)  
**User wait time**: ~2-10 seconds

---

## Performance Metrics

### Token Consumption by Mode

| Mode                       | Prompt Tokens | Response Tokens | Total |
| -------------------------- | ------------- | --------------- | ----- |
| 💬 General (no history)    | ~200          | ~50             | ~250  |
| 💬 General (with history)  | ~1700         | ~50             | ~1750 |
| 📚 App-info (no history)   | ~400          | ~50             | ~450  |
| 📚 App-info (with history) | ~1900         | ~50             | ~1950 |
| ⚡ Commands (no history)   | ~700          | ~40             | ~740  |
| ⚡ Commands (with history) | ~2200         | ~40             | ~2240 |
| Embedding generation       | ~7            | -               | ~7    |

### Time Breakdown

| Phase                        | Duration         | Location            |
| ---------------------------- | ---------------- | ------------------- |
| Save to Redux                | ~1ms             | Frontend            |
| SSE connection open          | ~10ms            | Network             |
| Stage 1: Embedding + routing | ~100-500ms       | Backend             |
| Stage 2: RAG retrieval       | <50ms            | Backend             |
| Stage 3: Ollama LLM call     | ~2-10s           | Backend → Ollama    |
| Command execution            | ~1ms             | Frontend            |
| Update aiResponse            | ~1ms             | Frontend            |
| **User sees response**       | **~2-10s total** | -                   |
| Embedding generation         | ~500-1000ms      | Async, non-blocking |

---

## Error Handling

### Backend Unreachable

```typescript
// backendService.ts catches fetch errors
onError('Failed to connect to backend. Is it running on port 3001?');
```

**User sees**: Error message in UI, transcription saved without AI response.

### Ollama API Error (Backend)

```typescript
// queryService.ts catches Ollama errors
// Sends error event via SSE
res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
```

### Invalid JSON from LLM (Backend)

```typescript
// jsonParser.ts has multiple fallback strategies
// If all fail, returns NONE command with error interpretation
return {
  commands: [
    {
      action: CommandAction.NONE,
      interpretation: 'Error: Could not parse AI response',
      aiResponse: 'I had trouble processing that. Please try again.',
    },
  ],
};
```

### Embedding Generation Fails

```typescript
// Non-blocking: logs error, transcription remains without embedding
// Future RAG queries will skip this item (no embedding to compare against)
logger.error('❌ Error generating embedding:', error);
```

**Impact**: Silent failure, no UI disruption, transcription still usable.

---

## Summary

### Complete Flow Duration

- **Fastest**: 💬 General Q&A without history (~2 seconds)
- **Typical**: ⚡ Command with history (~4-5 seconds)
- **Slowest**: Complex batch command with thinking model (~8-15 seconds)

### Key Optimizations

1. **Feature embeddings cached on backend startup**: No per-query overhead
2. **Three-mode routing**: 60-80% token reduction for non-command queries
3. **Single backend call per query**: SSE streaming for real-time feedback
4. **Query embedding reused**: Stage 1 embedding reused in Stage 2 (no duplicate)
5. **Async transcription embeddings**: User sees response immediately
6. **Handler registry pattern**: O(1) command dispatch, no switch overhead

### Total External Calls Per Query

- **Frontend → Backend**: 1 SSE call (blocking) + 1 embed call (async)
- **Backend → Ollama**: 1 embed + 1 chat (blocking) + 1 embed (async for transcription)
- **Never**: More than 1 LLM generation call per user input

### Token Efficiency

- **⚡ Commands mode**: ~700-2200 tokens (full command list)
- **📚 App-info mode**: ~400-1900 tokens (feature description, no commands)
- **💬 General mode**: ~200-1700 tokens (no commands, no app context)
- **Average savings**: ~60% vs always sending full command list
