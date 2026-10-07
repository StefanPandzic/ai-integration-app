---
description: 'Use when working with RAG (Retrieval-Augmented Generation), embeddings, semantic search, intent routing, or app knowledge base. Covers vector search over transcription history and feature similarity for command disambiguation.'
applyTo:
  [
    'backend/src/services/ragService.ts',
    'backend/src/services/intentRouting.ts',
    'backend/src/services/queryService.ts',
    'backend/src/config/appKnowledgeBase.ts',
    'backend/src/services/embedClient.ts',
    'src/features/ai/hooks/useCommandInterpreter.ts',
    'src/features/ai/services/backendService.ts',
  ]
---

# RAG System Guidelines

## Architecture: All RAG Lives in the Backend

All embedding generation, vector search, and intent routing is performed by the **Node.js backend** (`backend/src/`). The frontend only sends `text` + `transcriptionHistory` (+ optional `image`) to `POST /api/ai/query` and receives the result via SSE. There is no `ragService.ts`, `intentRouting.ts`, or `ollamaService.ts` in the frontend.

## Problem-Solving with RAG

**Semantic Reasoning**: Think through vector similarity and embedding spaces

**Analysis Patterns for RAG Issues**:

1. **False Positive Routing** (General Q&A triggers command mode):

   ```
   Question: Why does "What is theme park?" trigger commands?
   Thinking:
   - Check feature description in backend/src/config/appKnowledgeBase.ts
   - Is description too generic? ("Theme settings" → vague)
   - Similarity to 'theme' feature embedding should be <0.3
   - Also: isKnowledgeQuestion() raises threshold +0.3 → effective 0.6
   - Solution: Enrich feature description with app-specific context
   ```

2. **False Negative Routing** (Commands not detected):

   ```
   Question: Why doesn't "switch theme" trigger command mode?
   Thinking:
   - Is threshold too high? (base 0.3, but +0.3 for questions → 0.6)
   - Is isKnowledgeQuestion() incorrectly matching? (starts with "what/how/why"?)
   - Calculate expected similarity: "switch theme" ↔ 'theme' feature → should be >0.5
   - If consistently low: Feature description needs stronger semantic match
   ```

3. **Transcription Context Retrieval**:

   ```
   Question: Why isn't RAG finding relevant past conversations?
   Thinking:
   - Are embeddings generated? Check history items for .embedding !== undefined
   - Frontend sends history to backend; backend calls retrieveRelevant()
   - Similarity threshold: Are top-3 items scoring >0?
   - Log actual scores in backend queryService Stage 2 output
   ```

4. **Feature Embedding Cache**:
   ```
   Question: Why is the first query slow after a model switch?
   Thinking:
   - Model switch calls invalidateEmbeddingsCache()
   - Next query triggers initializeFeatureEmbeddings() (8 features × ~800ms = ~6s)
   - This is expected behavior; subsequent queries use the cache
   ```

**Semantic Similarity Intuition**:

- **High Similarity (>0.7)**: Nearly identical concepts ("toggle theme" ↔ "switch theme")
- **Medium Similarity (0.3-0.7)**: Related concepts ("dark mode" ↔ "app appearance")
- **Low Similarity (<0.3)**: Different concepts ("theme park" ↔ "app theme")

**Debugging RAG Routing** (read backend logs):

```
━━━ AI Query Pipeline ━━━
📥 Input: "what is theme"

📍 STAGE 1: Intent Routing
  ├─ Query embedding generated (768D)
  ├─ Max similarity: 0.420 (threshold: 0.600)
  ├─ Is question: true
  └─ Routed to: 💬 general (low similarity)

📚 STAGE 2: RAG Context Retrieval
  └─ Retrieved 2 relevant history items
```

## Architecture Overview

The backend uses **dual-purpose RAG** for two distinct semantic search operations:

1. **Transcription History Retrieval** — Semantic search over past conversations for contextual AI responses
2. **Intent Routing** — Semantic similarity between user queries and app features to route to one of three processing modes

Both use `cosineSimilarity()` from [ragService.ts](../../backend/src/services/ragService.ts) but serve different purposes.

---

## 1. Transcription History RAG

### Purpose

Provide conversational context by retrieving semantically relevant past transcriptions for the current query.

### Components (Backend)

**RAGService** ([backend/src/services/ragService.ts](../../backend/src/services/ragService.ts)):

- `cosineSimilarity(vecA, vecB)` — Cosine similarity between embedding vectors
- `retrieveRelevant(queryEmbedding, history, k)` — Top-k semantic search (uses pre-computed query embedding from Stage 1)
- `formatContext(transcriptions)` — Format top-k items for prompt injection (max ~6000 chars)

**EmbedClient** ([backend/src/services/embedClient.ts](../../backend/src/services/embedClient.ts)):

- `callOllamaEmbedApi(config, text)` — Single embedding via local `nomic-embed-text`
- `batchEmbeddings(config, texts)` — Batch embeddings for multiple texts
- Always hits local Ollama endpoint regardless of active generation model

**Frontend API** ([src/features/ai/services/backendService.ts](../../src/features/ai/services/backendService.ts)):

- `generateEmbeddings(texts)` — Calls `POST /api/ai/embed` to generate embeddings for new transcriptions
- Called after saving a transcription (async, non-blocking from user's perspective)

### Data Flow

```
Frontend: Save Transcription (embedding: undefined)
    ↓
Frontend: backendService.generateEmbeddings([text]) (async, non-blocking)
    ↓
Backend: POST /api/ai/embed → callOllamaEmbedApi() → number[]
    ↓
Frontend: Redux dispatch → update transcription with embedding
    ↓
Next Query: Frontend sends full history (with embeddings) to POST /api/ai/query
    ↓
Backend Stage 2: retrieveRelevant(queryEmbedding, history, 3) → top-3 items
    ↓
formatContext() → inject into prompt
```

### Configuration (Backend .env)

```bash
# Embedding model is always local, configured via aiModels.ts
# EMBEDDING_MODEL = nomic-embed-text (constant, not overridable)
```

### Implementation Rules

**Always**:

- Generate transcription embeddings asynchronously after saving (non-blocking)
- Filter history items: `t.embedding && t.embedding.length > 0` before RAG
- Reuse query embedding from Stage 1 for Stage 2 (don't generate twice)
- Format context with max ~6000 chars to avoid token limit

**Never**:

- Block transcription save on embedding generation
- Send full history to Ollama without top-k filtering
- Generate a second query embedding for RAG (Stage 1 embedding is reused)

---

## 2. Intent Routing RAG (Three-Mode)

### Purpose

Route the query to one of three processing modes using semantic similarity to app features.

| Mode          | Condition                                                  | Prompt content                |
| ------------- | ---------------------------------------------------------- | ----------------------------- |
| `💬 general`  | similarity < threshold                                     | Minimal assistant prompt      |
| `📚 app-info` | similarity >= threshold **and** `hasInformationalIntent()` | + matched feature description |
| `⚡ commands` | similarity >= threshold **and** action intent              | + full command list           |

### Components (Backend)

**App Knowledge Base** ([backend/src/config/appKnowledgeBase.ts](../../backend/src/config/appKnowledgeBase.ts)):

- `APP_FEATURES` — 8 app features, each with `id`, `name`, `description`, `relatedCommands` (legacy, unused for routing)
- Current features: `theme`, `production-lines`, `printers`, `language`, `transcription`, `app-text`, `microphone`, `commands`

**Intent Routing** ([backend/src/services/intentRouting.ts](../../backend/src/services/intentRouting.ts)):

- `isKnowledgeQuestion(query)` — regex: starts with what/who/when/where/why/how/tell me/explain
- `adjustThreshold(baseThreshold, isQuestion)` — returns `baseThreshold + 0.3` if question, else unchanged
- `hasInformationalIntent(query)` — matches patterns: `tell me about`, `explain`, `describe`, `list`, `show me`, `how many/much`, `what is`, `what are`

**Constants** ([backend/src/constants/index.ts](../../backend/src/constants/index.ts)):

- `INTENT_ROUTING_THRESHOLD = 0.3` — base threshold; becomes `0.6` for knowledge questions

### Decision Flow

**Query: "What is theme park?"**

```
Generate query embedding
├─ Max similarity to 8 features: ~0.15 (theme feature)
├─ isKnowledgeQuestion() → TRUE → threshold = 0.6
├─ 0.15 < 0.6 → 💬 general
└─ buildGeneralQuestionsPrompt() — no commands, no app context
```

**Query: "Tell me about production lines"**

```
Generate query embedding
├─ Max similarity to 8 features: ~0.72 (production-lines feature)
├─ isKnowledgeQuestion() → FALSE → threshold = 0.3
├─ 0.72 >= 0.3 → above threshold
├─ hasInformationalIntent() → TRUE ("tell me about")
└─ 📚 app-info → buildAppQuestionsPrompt() + inject feature description
```

**Query: "Switch to dark theme"**

```
Generate query embedding
├─ Max similarity to 8 features: ~0.78 (theme feature)
├─ isKnowledgeQuestion() → FALSE → threshold = 0.3
├─ 0.78 >= 0.3 → above threshold
├─ hasInformationalIntent() → FALSE
└─ ⚡ commands → buildCommandsPrompt(commandList)
```

### Feature Embedding Cache (Backend)

Feature embeddings are **cached on backend startup** in `featureEmbeddingsCache` (module-level variable in `queryService.ts`):

- `initializeFeatureEmbeddings()` — called on server start; generates one embedding per `APP_FEATURES` entry
- `invalidateEmbeddingsCache()` — called by `PUT /api/config/model`; forces re-init on next query
- Cache is `number[][]` — one vector per feature, same index order as `APP_FEATURES`

**There is no frontend-side feature embedding generation.**

### Tuning Thresholds

**INTENT_ROUTING_THRESHOLD** (default 0.3):

- Lower (0.1-0.2): More queries route to command/app-info modes (higher recall, more false positives)
- Higher (0.4-0.6): More queries route to general mode (higher precision, may miss commands)
- **Recommended**: 0.3 base with +0.3 for knowledge questions → effective 0.6 for questions

**Knowledge Question Adjustment** (+0.3):

- `isKnowledgeQuestion()` catches queries starting with what/how/why/who/when/where
- Raising threshold from 0.3 → 0.6 for these queries significantly reduces false positives
- Example: "What is production line efficiency?" needs 0.6 similarity to trigger command mode

### Adding New Features

**When adding new app features/commands:**

1. Add feature entry to `APP_FEATURES` in `backend/src/config/appKnowledgeBase.ts` with semantic-rich description
2. Write description optimized for embeddings (NOT keyword lists)
3. `relatedCommands` field is legacy — leave it empty or with keywords for documentation only, it is not used for routing
4. Restart backend to regenerate feature embeddings (or call `PUT /api/config/model` to invalidate cache)
5. Test with similar general questions to verify no false positives

**Good Description** (semantic-rich):

```typescript
{
  id: 'theme',
  name: 'Theme & Appearance',
  description: 'Toggle user interface color scheme between light mode and dark mode. Switch visual theme settings by voice command. Change application display theme instantly.',
  relatedCommands: [], // Legacy field, not used in routing
}
```

**Bad Description** (too generic):

```typescript
{
  id: 'theme',
  name: 'Theme',
  description: 'Theme settings', // ❌ Too vague, will cause false positives
}
```

---

## Embedding Management

### Transcription Type

```typescript
// backend/src/types/index.ts
interface Transcription {
  id: string;
  text: string;
  timestamp: number;
  embedding?: number[]; // Optional (undefined until backend generates it)
  aiResponse?: string;
}
```

Note: `embedding` is `number[] | undefined` (not `null`) — filter with `t.embedding && t.embedding.length > 0`.

---

## Performance Considerations

**Feature Embeddings**:

- Generated once on backend startup (~5-10s for 8 features)
- Invalidated and regenerated when active model changes
- Reused for all queries until invalidated

**Transcription Embeddings**:

- Generated async after save via `POST /api/ai/embed`
- Non-blocking: user does not wait for embedding before next action
- Query embedding from Stage 1 is reused in Stage 2 — no duplicate generation

**Vector Search**:

- Filter items without embeddings before similarity calculation
- Default k=3 for context retrieval
- `formatContext()` caps at ~6000 chars

**Token Efficiency**:

- `💬 general` mode: ~200 tokens prompt
- `📚 app-info` mode: ~400 tokens
- `⚡ commands` mode: ~2000 tokens (full command list)

---

## Anti-Patterns

**❌ Don't**:

- Put any RAG or embedding logic in the frontend (beyond calling `/api/ai/embed`)
- Block transcription save on embedding generation
- Send full history array to Ollama without top-k filtering
- Generate feature embeddings on every query (cache on startup)
- Set intent routing threshold too high (>0.6) or too low (<0.1)
- Write vague single-word feature descriptions
- Use `relatedCommands` for routing (it's legacy, unused)
- Generate a second query embedding for RAG — reuse the one from Stage 1

**✅ Do**:

- Keep all RAG logic in `backend/src/services/`
- Generate transcription embeddings async after save
- Reuse query embedding across pipeline stages
- Use semantic descriptions optimized for embedding similarity
- Handle missing embeddings gracefully (`t.embedding && t.embedding.length > 0`)
- Log retrieval metrics via backend console (Stage 1 and Stage 2 outputs)
- Use `hasInformationalIntent()` to route to `📚 app-info` instead of `⚡ commands`

---

## Testing Intent Routing

**Test Cases**:

```typescript
// Should be 💬 general (low similarity or high threshold for questions)
'What is theme park?'; // Not about app theme; question → threshold 0.6
'Tell me about production lines in general'; // hasInformationalIntent → 📚 app-info, not commands
'How do printers work?'; // General question → threshold 0.6
'Explain theme in literature'; // hasInformationalIntent → 📚 app-info

// Should be ⚡ commands (high similarity, action intent)
'Switch to dark theme'; // High similarity, no informational intent
'Enable production line 1'; // Clear action
'Turn on printer 2'; // Device control
'Toggle theme'; // Action verb
'Activate line 2'; // Production control

// Should be 📚 app-info (high similarity + informational)
'Tell me about themes'; // hasInformationalIntent + high similarity to 'theme'
'What is production line control?'; // isKnowledgeQuestion + high similarity → threshold 0.6; depends on score
'Describe the language settings'; // hasInformationalIntent
```

**Read backend logs**:

```
📍 STAGE 1: Intent Routing
  ├─ Query embedding generated (768D)
  ├─ Max similarity: 0.420 (threshold: 0.600)
  ├─ Is question: true
  └─ Routed to: 💬 general (low similarity)
```

---

## Related Documentation

- [Ollama Integration Guidelines](./ollama-integration.instructions.md) — Full pipeline, model config, SSE streaming
- [Ollama Setup](../../OLLAMA_SETUP.md) — Local Ollama installation

```

```
