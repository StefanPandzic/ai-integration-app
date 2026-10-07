# Speech-to-Text Backend

Node.js TypeScript backend for AI-powered voice command processing with real-time SSE streaming.

## Architecture

Handles all AI business logic:

- **Intent Routing**: Semantic similarity to disambiguate commands vs Q&A
- **RAG Context**: Semantic search over transcription history
- **Ollama Integration**: Multi-model support (local/cloud) with prompt building and SSE streaming
- **Feature Embeddings**: Pre-generated on startup for fast routing
- **Model Configuration**: Dynamic model switching with thinking mode support
- **JSON Parsing**: Robust extraction with multiple fallback strategies

Frontend handles:

- UI rendering and state management
- Command execution (theme changes, production control, etc.)
- Transcription persistence (localStorage)

## Setup

1. **Install dependencies**:

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment** (optional - only for cloud models):

   ```bash
   cp .env.example .env
   ```

3. **Environment variables** (optional):

   ```bash
   PORT=3001                              # Server port (default: 3001)
   CORS_ORIGIN=http://localhost:5173      # Frontend URL
   OLLAMA_API_KEY=your-key-here           # Only for cloud models (Gemma 31B)
   ```

   **Note**: Model URLs and names are configured in `src/config/aiModels.ts`, not in `.env`. Only sensitive data (API keys) belongs in environment variables.

## Model Configuration

The backend supports multiple AI models with different capabilities:

### Available Models

| Model           | Type  | Thinking Support | Authentication   |
| --------------- | ----- | ---------------- | ---------------- |
| **llama3**      | Local | ❌ No            | Not required     |
| **deepseek-r1** | Local | ✅ Yes           | Not required     |
| **gemma4:31b**  | Cloud | ✅ Yes           | API key required |

### Model Metadata

All models are defined in `src/config/aiModels.ts` with:

- `name`: Model identifier (e.g., 'llama3', 'deepseek-r1')
- `type`: 'local' (localhost) or 'cloud' (api.ollama.com)
- `requiresAuth`: Whether API key is required
- `supportsThinking`: Enables reasoning mode with real-time thinking display
- `apiUrl`: Base URL for Ollama API
- `modelTag`: Actual model tag sent to API (e.g., 'llama3:latest')

### Dynamic Model Switching

The active model can be changed at runtime via API:

```bash
curl -X PUT http://localhost:3001/api/config/model \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-r1"}'
```

Switching models:

- Invalidates the feature embeddings cache
- Regenerates embeddings with the new model
- Updates API URL and authentication settings

### Thinking Mode

Models with `supportsThinking: true` (DeepSeek-R1, Gemma 4) provide:

- Real-time reasoning display via SSE `thinking` events
- Enhanced accuracy for complex queries
- Step-by-step problem solving

Thinking is streamed separately from the final response, allowing frontend to display the AI's reasoning process.

4. **Ensure Ollama is running** (see main OLLAMA_SETUP.md):

   ```bash
   ollama ps
   ```

5. **Start backend**:
   ```bash
   npm run dev    # Development (with hot reload)
   npm run build  # Production build
   npm start      # Production
   ```

## API Endpoints

### POST `/api/ai/query`

Process voice command with SSE streaming for real-time thinking display.

**Request:**

```json
{
  "text": "turn on line 1",
  "transcriptionHistory": [
    {
      "id": "123",
      "text": "previous conversation",
      "timestamp": 1234567890,
      "embedding": [0.1, 0.2, ...]
    }
  ]
}
```

**Response (SSE stream):**

```
event: thinking
data: {"text":"1. Analyzing command..."}

event: thinking
data: {"text":"2. Detected action keyword..."}

event: complete
data: {"response":"...","command":{...},"mode":"⚡ commands"}
```

### POST `/api/ai/embed`

Generate embeddings for transcription storage.

**Request:**

```json
{
  "texts": ["hello world", "how are you"]
}
```

**Response:**

```json
{
  "embeddings": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...]
  ]
}
```

### GET `/api/config/models`

Fetch available AI models with metadata.

**Response:**

```json
{
  "models": [
    {
      "name": "llama3",
      "type": "local",
      "requiresAuth": false,
      "supportsThinking": false,
      "apiUrl": "http://localhost:11434",
      "modelTag": "llama3:latest"
    },
    {
      "name": "deepseek-r1",
      "type": "local",
      "requiresAuth": false,
      "supportsThinking": true,
      "apiUrl": "http://localhost:11434",
      "modelTag": "deepseek-r1:latest"
    },
    {
      "name": "gemma4:31b",
      "type": "cloud",
      "requiresAuth": true,
      "supportsThinking": true,
      "apiUrl": "https://api.ollama.com",
      "modelTag": "gemma4:31b-cloud"
    }
  ]
}
```

### PUT `/api/config/model`

Switch the active AI model dynamically.

**Request:**

```json
{
  "model": "deepseek-r1"
}
```

**Response:**

```json
{
  "success": true,
  "model": "deepseek-r1:latest",
  "apiUrl": "http://localhost:11434"
}
```

**Effects:**

- Updates active model configuration
- Invalidates feature embeddings cache
- Regenerates embeddings with new model
- Subsequent queries use the new model

## Three-Mode Routing

1. **💬 General Questions** - Low similarity to app features
   - Example: "What is Python?"
   - Mode: No commands in prompt, general knowledge response

2. **📚 App Related Questions** - High similarity + informational intent
   - Example: "Tell me about production lines"
   - Mode: App context injected, informational response

3. **⚡ Commands** - High similarity + action intent
   - Example: "Turn on line 1"
   - Mode: All commands in prompt, command detection

## Key Components

### Configuration (`src/config/`)

- **aiModels.ts**: Model metadata registry (local/cloud, thinking support, auth requirements)
- **ollamaConfig.ts**: Dynamic configuration management with model switching
- **commandRegistry.ts**: Command definitions synced with frontend
- **appKnowledgeBase.ts**: Feature descriptions for intent routing

### Services (`src/services/`)

- **queryService.ts**: Main AI pipeline orchestrator (3-stage processing)
- **ollamaClient.ts**: Ollama API client with SSE streaming
- **embedClient.ts**: Embedding generation for RAG
- **ragService.ts**: Semantic search and context retrieval
- **intentRouting.ts**: Query classification utilities
- **promptBuilder.ts**: Mode-specific prompt generation
- **jsonParser.ts**: Robust JSON extraction with multiple fallback strategies

### JSON Parser

Handles common LLM response issues:

1. **Code block extraction**: Finds JSON in \`\`\`json blocks
2. **Last object match**: Extracts final complete JSON object
3. **Greedy match**: Falls back to any JSON content
4. **Normalization**: Fixes trailing commas, quotes, control characters

Multiple strategies ensure reliable command extraction even with varied LLM formatting.

## Performance

- **Feature embeddings**: Generated once on startup (~0.5s), cached in memory
- **Intent routing**: 60-80% token reduction vs always sending commands
- **SSE streaming**: Real-time thinking display with <50ms latency
- **Response times**: 2-10 seconds typical (depends on model + hardware)
- **Model switching**: ~0.5s for cache invalidation + embedding regeneration

## Development

```bash
npm run dev        # Start with hot reload
npm run type-check # TypeScript validation
```

## Deployment

```bash
npm run build  # Compile TypeScript to dist/
npm start      # Run compiled code
```

**Docker Compose** (recommended):

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - '3001:3001'
    environment:
      - OLLAMA_API_URL=http://ollama:11434
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama
    ports:
      - '11434:11434'
    volumes:
      - ollama-data:/root/.ollama

  frontend:
    build: .
    ports:
      - '5173:5173'
    environment:
      - VITE_BACKEND_URL=http://backend:3001

volumes:
  ollama-data:
```

## Troubleshooting

**Backend won't start:**

- Check Ollama is running: `ollama ps`
- Verify `.env` file exists with correct values
- Check port 3001 is not in use

**Feature embeddings fail:**

- Ensure `nomic-embed-text` model is pulled: `ollama pull nomic-embed-text`
- Check Ollama logs for errors

**Model switching doesn't work:**

- Verify model name matches one in `aiModels.ts`
- For local models, ensure they're pulled: `ollama list`
- For cloud models, check API key is set in `.env`

**Thinking mode not working:**

- Verify selected model has `supportsThinking: true`
- Check frontend is handling `thinking` SSE events
- llama3 does NOT support thinking (use deepseek-r1 or gemma4:31b)

**CORS errors:**

- Verify `CORS_ORIGIN` matches frontend URL
- Check browser console for specific CORS error details
