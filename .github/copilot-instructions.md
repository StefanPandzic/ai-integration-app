# Speech-to-Text App Guidelines

## Build and Test

**Frontend**:

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + production build
npm run preview      # Preview production build
```

**Backend**:

```bash
cd backend
npm install          # Install backend dependencies
npm run dev          # Start backend with hot reload (ts-node-dev)
npm run build        # Build backend to dist/
npm start            # Run production build
npm run type-check   # TypeScript type checking
```

**Note**: No testing framework currently configured (no Vitest, no test files)

## Architecture

**Frontend-Backend Separation**: Clean separation between UI and AI business logic

The app uses a **Node.js TypeScript backend** for all AI operations:

**Backend** (`/backend/`):

- Intent routing (RAG-based semantic similarity)
- RAG context retrieval (semantic search over history)
- Ollama API communication (prompt building, streaming)
- Feature embeddings (pre-generated on startup)
- Multi-model configuration (local and cloud AI models)
- Robust JSON parsing with fallback strategies

**Frontend** (`/src/`):

- UI rendering and user interaction
- Command execution (theme changes, production control, etc.)
- Transcription management (localStorage persistence)
- Real-time SSE streaming for thinking display

**Feature-Based Organization**: Clean separation by domain functionality

The frontend is organized into feature-based modules in `src/features/`:

- **`features/speech/`** - Speech-to-text recognition and transcription management
- **`features/ai/`** - Backend API client, command execution, UI components
- **`features/production/`** - Production line controls

Each feature contains:

- `components/` - UI components
- `hooks/` - React hooks (state management)
- `services/` - Business logic and external API integrations
- `types/` - TypeScript type definitions
- `config/` - Feature-specific configuration
- `index.ts` - Barrel export for clean imports

**Service-Hook-Component Pattern**: Clean three-layer separation

**Service Layer**: Abstract external APIs behind interfaces

- Define interface in `src/features/{feature}/types/` (e.g., `IRecognitionService`)
- Implement as factory function in `src/features/{feature}/services/`
- Factory functions return objects with methods, using closure for private state
- Services are **stateless** and handle external integrations
- Store service instances in `useRef` within hooks (not state—survives re-renders)
- See [recognitionService.ts](../src/features/speech/services/recognitionService.ts) for factory function pattern

**Custom Hooks**: Wrap services with React state management

- Place stateful logic in `src/features/{feature}/hooks/`
- Hook consumes service, exposes clean API to components
- Use `useRef` for service instances, `useState` for state, `useCallback` for callbacks
- Transcription persistence now handled by Redux store + Redux Persist (see [transcriptionSlice.ts](../src/store/slices/transcriptionSlice.ts))

**State Management**: Redux for transcription and app state

- **Redux Store**: Centralized state management with Redux Toolkit
- **Transcription CRUD**: All operations in `transcriptionSlice.ts` (addTranscription, deleteTranscription, clearHistory, etc.)
- **Persistence**: Redux Persist automatically syncs to localStorage
- **Speech Hook**: `useSpeechRecognition` handles only voice input (Web Speech API wrapper)
- See [useSpeechRecognition.ts](../src/features/speech/hooks/useSpeechRecognition.ts) for voice-only pattern

**Components**: Focused, reusable UI components

- One component per file in `src/features/{feature}/components/`
- **Pure presentational**: receive all state/handlers via props
- No direct service/hook imports (except in App.tsx)
- Use Chakra UI for all styling and theming
- Key components:
  - **Speech Feature** (speech recognition only):
    - `SpeechRecognitionButton` - Start/stop recording with animation
    - `LanguageSelector` - Dropdown for 14 supported languages (including Serbian)
    - `MicrophoneIndicator` - Real-time audio level visualization
  - **AI Feature** (conversation and AI processing):
    - `CommandPanel` - AI command feedback and processing status
    - `ThinkingPanel` - Real-time thinking display (for reasoning models)
    - `ModelSelector` - Dropdown for model selection (local/cloud models)
    - `ConversationHistory` - Chat-style conversation history with AI responses
  - **Shared Components** (cross-feature UI):
    - `TranscriptInput` - Editable textarea for voice + manual text input
  - **Production Feature**:
    - `ProductionLinePanel` - Visual controls for 3 production lines + printers (voice-controlled)

**Types**: Feature-specific type definitions

- Each feature has its own `types/` folder with focused type files
- **Speech types**: `recognition.ts` (RecognitionState, IRecognitionService), `transcription.ts` (Transcription)
- **AI types**: `commands.ts` (Command, CommandAction), `processing.ts` (ProcessingStep), `rag.ts` (RAG types)
- **Production types**: `index.ts` (ProductionLineState, PrinterState)
- Interface naming: prefix with `I` for service interfaces (e.g., `IRecognitionService`)
- Use barrel exports (`index.ts`) for clean imports

**Data Flow**: `Service (factory function) → Hook (useState/useRef) → Component (props) → User`

**Folder Structure**:

```
backend/                 # Node.js TypeScript backend
  src/
    config/
      aiModels.ts                  # Model metadata (local/cloud, thinking support)
      ollamaConfig.ts              # Dynamic Ollama API configuration
      commandRegistry.ts           # Command definitions (synced with frontend types)
      appKnowledgeBase.ts          # App features for intent routing
    constants/
      index.ts                     # Backend constants (INTENT_ROUTING_THRESHOLD)
    services/
      ollamaClient.ts              # Ollama API client with SSE streaming
      embedClient.ts               # Ollama embeddings API client
      ragService.ts                # RAG context retrieval
      intentRouting.ts             # Intent routing utilities
      promptBuilder.ts             # Prompt generation for 3 modes
      queryService.ts              # Main AI pipeline orchestrator
      jsonParser.ts                # Robust JSON extraction with fallbacks
    types/
      index.ts                     # Shared types (Command, Transcription, etc.)
    index.ts                       # Express server + SSE + config endpoints
  package.json
  tsconfig.json

src/                     # React frontend
  components/            # Shared UI components
    TranscriptInput.tsx              # General text input (speech + manual editing)
    index.ts                         # Barrel export

  features/
    speech/              # Speech-to-text feature
      components/
        SpeechRecognitionButton.tsx
        MicrophoneIndicator.tsx
        LanguageSelector.tsx
      hooks/
        useSpeechRecognition.ts       # Voice input (Web Speech API wrapper)
        useMicrophone.ts
      services/
        recognitionService.ts          # Web Speech API wrapper
      types/
        recognition.ts                 # Speech recognition types
        transcription.ts               # Transcription types
        index.ts                       # Barrel export
      index.ts                         # Feature barrel export

    ai/                  # AI integration feature
      components/
        CommandPanel.tsx               # Command feedback UI
        ThinkingPanel.tsx              # Real-time thinking display
        ModelSelector.tsx              # AI model selection dropdown
        ConversationHistory.tsx        # Chat history (user + AI responses)
      hooks/
        useCommandInterpreter.ts       # Backend integration + command execution
      services/
        backendService.ts              # Backend API client (SSE streaming)
        commandExecutor.ts             # Local command execution (frontend)
      types/
        commands.ts                    # Command types
        processing.ts                  # Progress tracking types
        index.ts                       # Barrel export
      index.ts                         # Feature barrel export

    production/          # Production line feature
      components/
        ProductionLinePanel.tsx
      hooks/
        useProductionLine.ts
      types/
        index.ts                       # Production types
      index.ts                         # Feature barrel export

  constants/             # Shared utilities
    colors.ts

  App.tsx                # Main application
  main.tsx               # Entry point
```

## Centralized Logging System

**Feature-Based Logging**: Structured logging with feature filtering and log levels

The app uses a centralized logging system in `src/features/logging/` that replaces all direct `console.*` usage:

**Logger Factory Pattern**: Create feature-specific logger instances

```typescript
import { createLogger } from '../../logging';

const logger = createLogger('speech'); // or 'ai', 'production', 'app', 'rag', 'ollama'

// Usage
logger.debug('Debug information');
logger.info('✅ Operation successful');
logger.warn('⚠️ Warning message');
logger.error('❌ Error occurred:', error);
```

**Configuration**: Runtime-adjustable settings in `logConfig`

- **Enabled Features**: `logConfig.enabledFeatures` - Array of feature names to log (default: all enabled)
- **Log Level**: `logConfig.logLevel` - Minimum level to display ('debug' | 'info' | 'warn' | 'error')
- **Verbose Ollama**: `logConfig.enableVerboseOllama` - Controls full prompt/response debug blocks (default: dev only)
- **Auto-Configuration**: Debug logs enabled in dev mode (`import.meta.env.DEV`), info+ in production

```typescript
import {
  updateLogConfig,
  disableFeature,
  setLogLevel,
} from './features/logging';

// Disable specific feature logs
disableFeature('ollama'); // Suppress verbose Ollama debug output

// Change log level
setLogLevel('warn'); // Only show warnings and errors

// Toggle verbose Ollama logging
updateLogConfig({ enableVerboseOllama: false }); // Hide full prompt/response blocks
```

**Feature Granularity**: 6 feature names for targeted filtering

- `speech` - Speech recognition, transcription management, microphone
- `ai` - Command interpretation, execution, general AI operations
- `rag` - RAG context retrieval, semantic search
- `ollama` - Ollama API calls, prompt/response logging (high volume)
- `production` - Production line and printer control
- `app` - App.tsx orchestration layer

**Benefits**:

- **Feature Filtering**: Disable noisy logs while debugging specific features
- **Log Levels**: Control verbosity without code changes
- **Emoji Preservation**: All existing emoji prefixes (✅ ❌ 🎤 🏭) maintained
- **Tree Formatting**: Preserves `├─`, `└─`, `━━━` symbols for pipeline tracing
- **Verbose Control**: Special flag for 39-statement Ollama debug panel (full prompts/responses)

**Adding Logging to New Features**:

1. Import and create logger at top of file:

   ```typescript
   import { createLogger } from '../../logging';
   const logger = createLogger('feature-name');
   ```

2. Replace all `console.*` calls:

   ```typescript
   // Before
   console.log('Processing...');
   console.error('Failed:', error);

   // After
   logger.info('Processing...');
   logger.error('Failed:', error);
   ```

3. Use appropriate log levels:
   - `logger.debug()` - Detailed debugging info (only in dev mode by default)
   - `logger.info()` - General informational messages (default level in production)
   - `logger.warn()` - Warning messages
   - `logger.error()` - Error messages

**Folder Structure**:

```
src/features/logging/
  services/
    logger.ts          # Logger factory function, shouldLog filtering
  config/
    logConfig.ts       # Configuration object, update functions
  types/
    index.ts           # LogLevel, FeatureName, ILogger, LoggerConfig types
  index.ts             # Barrel export
```

## Problem-Solving Approach

**Transparent Reasoning**: Use explicit thinking when working with complex problems

**When to Think Out Loud**:

- **Architecture decisions**: Before implementing new features, reason through service/hook/component separation
- **Performance optimization**: Analyze API call patterns, re-render triggers, or state management issues
- **RAG/Ollama integration**: Trace through embedding generation, semantic routing, and token efficiency
- **Cross-feature dependencies**: Consider impact when features interact (e.g., AI commands → production state)
- **Error diagnosis**: Walk through data flow to identify where things break
- **Ambiguous requirements**: Clarify intent before proceeding with implementation

**Thinking Patterns for This Codebase**:

1. **Service Layer Analysis**:

   ```
   Question: Should this be a service or a hook?
   Thinking:
   - Does it interact with external APIs? → Service (factory function)
   - Does it manage React state? → Hook
   - Does it combine service + state? → Hook that wraps service
   ```

2. **Performance Investigation**:

   ```
   Question: Why are there multiple Ollama calls?
   Thinking:
   - Check App.tsx → handleSaveWithCommandCheck flow
   - Verify interpretAndExecute uses aiResponse from command
   - Confirm no duplicate generateResponse calls
   - Validate RAG routing happens before API call
   ```

3. **RAG Routing Decision**:

   ```
   Question: Should this query trigger command mode?
   Thinking:
   - Check hasInformationalIntent() patterns first
   - Calculate semantic similarity to feature embeddings
   - Compare to threshold (0.3, +0.3 for questions → 0.6)
   - High similarity → command mode, Low → conversational
   ```

4. **Feature Organization**:
   ```
   Question: Where should this new component/hook go?
   Thinking:
   - What domain does it belong to? (speech/ai/production)
   - Does it need a new feature folder?
   - What types will it import/export?
   - How will App.tsx orchestrate it?
   ```

**Benefits of Explicit Reasoning**:

- Catches architectural mistakes before implementation
- Makes optimization decisions transparent
- Helps identify performance bottlenecks
- Validates assumptions about data flow
- Documents decision-making process

**Example Reasoning Session**:

```
User: "Add a command to restart the app"

Thinking:
1. This is a new voice command → Follow add-voice-command pattern
2. Command type: Boolean action (no parameters)
3. Execution: Should it clear all state or just reset UI?
   - Clear transcriptions? User might want to keep history
   - Reset production lines? Could be disruptive
   - Just reset form state? More predictable
4. Decision: Reset only form/input state, preserve history
5. Implementation: Add RESTART_SESSION to CommandAction enum
```

## Code Conventions

**TypeScript**

- Strict mode enabled: `strict: true` in tsconfig.json
- Define interfaces for all props, state, and service APIs
- No `any` types unless absolutely necessary
- Use `import.meta.env` for environment variables (Vite-specific)

**Styling**

- Use Chakra UI components and props exclusively
- No CSS modules, styled-components, or inline styles
- Use `useAppColors()` hook from `src/constants/colors.ts` for centralized theme-aware colors
- Pattern: `const colors = useAppColors()` then use `colors.bgPrimary`, `colors.textBlue`, etc.
- Fallback: `useColorModeValue('light', 'dark')` for one-off color needs

**State Management**

- **Redux Toolkit** for global state (transcriptions, commands, production, app settings)
- **Redux Persist** automatically syncs specified slices to localStorage
- Use `useAppSelector` for reading state, `useAppDispatch` for dispatching actions
- Local `useState` only for transient UI state (form inputs, loading flags)
- See [store/index.ts](../src/store/index.ts) and slice files in `src/store/slices/`

**Persistence**

- Redux Persist automatically syncs to localStorage (configured in store)
- No manual `localStorage.setItem` for persisted state
- See Redux configuration in [store/index.ts](../src/store/index.ts) and [transcriptionSlice.ts](../src/store/slices/transcriptionSlice.ts)

**Environment Variables**

- Frontend: Use `VITE_` prefix (Vite requirement)
- Backend: Standard Node.js environment variables
- Access via `import.meta.env.VITE_VARIABLE_NAME` (frontend) or `process.env.VARIABLE_NAME` (backend)
- Provide fallback defaults in services

**Frontend** (`.env`):

```bash
VITE_BACKEND_URL=http://localhost:3001  # Backend API URL
```

**Backend** (`backend/.env`):

```bash
PORT=3001                              # Server port (default: 3001)
CORS_ORIGIN=http://localhost:5173      # Frontend URL
OLLAMA_API_KEY=your-key-here           # Only for cloud models (optional)
```

**Note**: Model URLs and names are configured in `backend/src/config/aiModels.ts`, not in `.env`.

## AI/Ollama Integration

**Multi-Model AI via Backend**: Supports multiple Ollama models (local and cloud) through Node.js backend

- **Backend Service**: [queryService.ts](../backend/src/services/queryService.ts) orchestrates AI pipeline
- **Frontend Service**: [backendService.ts](../src/features/ai/services/backendService.ts) communicates via SSE
- **Executor**: [commandExecutor.ts](../src/features/ai/services/commandExecutor.ts) maps commands to app actions (stays in frontend)
- **Hook**: [useCommandInterpreter.ts](../src/features/ai/hooks/useCommandInterpreter.ts) coordinates flow
- **Registry**: [commandRegistry.ts](../backend/src/config/commandRegistry.ts) centralized command definitions with metadata
- **RAG Semantic Routing**: [ragService.ts](../backend/src/services/ragService.ts) uses embeddings to route queries (60-80% token reduction)
- **JSON Parser**: [jsonParser.ts](../backend/src/services/jsonParser.ts) robust JSON extraction with multiple fallback strategies
- **Setup**: See [OLLAMA_SETUP.md](../OLLAMA_SETUP.md) for Ollama installation
- **Backend Setup**: See [backend/README.md](../backend/README.md) for backend configuration

**Model Configuration System**:

- **Model Metadata**: All models (local/cloud) defined in `backend/src/config/aiModels.ts`
  - `name`: Model identifier (e.g., 'llama3', 'deepseek-r1', 'gemma4:31b')
  - `type`: 'local' (localhost) or 'cloud' (api.ollama.com)
  - `requiresAuth`: Whether API key is required
  - `supportsThinking`: Whether model supports thinking/reasoning mode (DeepSeek-R1, Gemma 4)
  - `apiUrl`: Base URL for Ollama API
  - `modelTag`: Actual model tag sent to API (e.g., 'llama3:latest')
- **Dynamic Configuration**: `backend/src/config/ollamaConfig.ts` manages runtime model switching
- **Available Models**:
  - **llama3** (local, default) - Fast, no thinking/vision support
  - **deepseek-r1** (local) - Reasoning model with thinking capabilities, no vision
  - **gemma4:31b** (cloud) - Large cloud model with thinking + vision support
- **Vision Support**: `supportsVision` flag on model metadata; images (base64) forwarded only to vision-capable models
- **API Key**: Set `OLLAMA_API_KEY` in `backend/.env` for cloud models only
- **Embeddings**: Always uses local model (nomic-embed-text) regardless of active model

**Architecture (Backend SSE Streaming)**:

The backend uses **three-stage optimization** for command processing:

**Stage 1: Intent Routing (Backend)**

1. `queryService.processQuery()` generates query embedding via Ollama embeddings API
2. Calculates cosine similarity between query and pre-generated feature embeddings (cached on startup)
3. Routes based on similarity threshold (0.3, adjusted to 0.6 for questions via `+0.3` boost)
4. **Token Reduction**: 60-80% on average by routing away from command mode
   - Low similarity (<0.3): **💬 General Questions** - No commands in prompt
   - High similarity (>=0.3) + informational: **📚 App Questions** - App context in prompt
   - High similarity (>=0.3) + action: **⚡ Commands** - All commands in prompt
5. **Informational query detection**: Patterns like "tell me about", "explain" force app-question mode

**Stage 2: RAG Context Retrieval (Backend)**

1. Semantic search over transcription history sent from frontend
2. Retrieve top-3 relevant items using cosine similarity
3. Format context (~1500 tokens) and inject into prompt

**Stage 3: Ollama Call + SSE Streaming (Backend → Frontend)**

1. **Backend**: Build mode-specific prompt (with thinking instructions if model supports it), call Ollama with streaming enabled
2. **SSE Events**: Stream thinking chunks in real-time (`event: thinking`)
3. **Parse Response**: Extract Command objects from AI response using `jsonParser.ts`
   - Multiple fallback strategies for JSON extraction
   - Normalizes common LLM JSON formatting issues
4. **Complete Event**: Send final result (`event: complete` with response + commands)
5. **Frontend**: Execute commands locally, update UI

**Dual-Purpose Response**: Returns `Command` object with:

- `action`: Detected command (TOGGLE_THEME, CLEAR_TRANSCRIPTION, TOGGLE_PRODUCTION_LINE, etc.) or NONE
- `parameters`: Command parameters (theme, language, lineId, title, subtitle, etc.)
- `interpretation`: What the AI understood
- `aiResponse`: Contextual conversational response

**Contextual Responses**:

- Commands get acknowledgment: "Line 1 is now active!"
- Regular text gets conversational response: "That's interesting!"

**Flow**: Input → Backend SSE → Intent Routing → RAG → Ollama → Stream thinking → Parse commands → Frontend executes → Save with AI response

**Batch Commands**: Execute multiple commands in one input

- Example: "Turn on line 1 and enable printer 2"
- Returns `CommandBatch` with multiple `Command` objects
- Executed sequentially via `CommandExecutor.executeBatch()`

**Supported Commands**:

- **Theme**: Toggle theme, set specific theme (light/dark)
- **Transcription**: Clear all history
- **Language**: Change speech recognition language (14 languages)
- **App Text**: Change app title and/or subtitle
- **Production**: Toggle production lines (1-3), toggle printers (1-3)

**Note**: Command categories exist in `commandRegistry.ts` but are not used for filtering. Token reduction comes from routing decision (conversational vs command mode), not from category-based command filtering.

**Benefits**:

- **Intent Filtering**: 60-80% token reduction, faster prompts, scales to 100+ commands
- **Unified Response**: 50% fewer API calls (was 2 calls, now 1)
- **Speed**: 2-10 seconds response time (vs 4-20 seconds without optimizations)
- **Context-Aware**: AI responses aware of detected commands
- **Batch Support**: Multiple commands in one natural language input

**Implementation Pattern**:

```typescript
// Frontend - Send query to backend with SSE streaming
await backendService.queryWithStreaming(
  text,
  transcriptionHistory,
  (thinkingChunk) => {
    // Real-time thinking display
    updateThinkingPanel(thinkingChunk);
  },
  (result) => {
    // Final response with commands
    if (result.command || result.commandBatch) {
      commandExecutor.executeBatch(result.commandBatch);
    }
  },
  (error) => {
    handleError(error);
  },
);

// Backend - Process query with three-stage pipeline
const result = await queryService.processQuery(text, transcriptionHistory, res);
// 1. Intent routing via semantic similarity
// 2. RAG context retrieval
// 3. Ollama call with SSE streaming

// Backend streams thinking via SSE
res.write(`event: thinking\n`);
res.write(`data: ${JSON.stringify({ text: thinkingChunk })}\n\n`);

// Backend sends final result
res.write(`event: complete\n`);
res.write(`data: ${JSON.stringify({ response, command, mode })}\n\n`);
```

**Backend API Endpoints**:

- **POST `/api/ai/query`**: Process voice command with SSE streaming (main AI pipeline)
- **POST `/api/ai/embed`**: Generate embeddings for transcription storage
- **GET `/api/config/models`**: Fetch available AI models (local/cloud) with metadata
- **PUT `/api/config/model`**: Switch active AI model dynamically (invalidates embeddings cache)

**Model Switching Flow**:

```typescript
// Frontend - Get available models
const { models } = await fetch('/api/config/models').then((res) => res.json());

// Frontend - Switch to DeepSeek-R1 (local model with thinking)
await fetch('/api/config/model', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'deepseek-r1' }),
});

// Backend - Updates config, invalidates cache, regenerates feature embeddings
// Next query will use new model with thinking capabilities
```

## RAG (Retrieval-Augmented Generation)

**Vector-Based Semantic Search**: Uses Ollama embeddings for dual-purpose RAG (Backend)

- **Transcription History RAG**: Semantic search over past conversations for contextual AI responses
- **Intent Routing RAG**: Feature similarity to disambiguate app commands vs general Q&A
- **Backend Service**: [ragService.ts](../backend/src/services/ragService.ts) handles vector similarity and context formatting
- **Knowledge Base**: [appKnowledgeBase.ts](../backend/src/config/appKnowledgeBase.ts) defines app features for intent routing
- **Frontend**: Sends transcription history to backend, receives embeddings from backend API
- **Configuration**: Backend environment variables for embedding model

**Quick Reference**:

```typescript
// Frontend - Send history to backend
const result = await backendService.queryWithStreaming(text, transcriptionHistory, ...);
// Backend retrieves top-3 relevant items, formats context, injects into prompt

// Backend - Intent routing via semantic similarity
const routingResult = await ragService.retrieveAppFeatures(
  text,
  featureEmbeddings,  // Cached on backend startup
  threshold,
);
// Returns mode: 'general' | 'app-info' | 'commands'

// Frontend - Generate embeddings for transcriptions
const embeddings = await backendService.generateEmbeddings([text1, text2]);
// Backend calls Ollama embeddings API, returns vectors
```

**Environment Variables** (Backend):

```bash
OLLAMA_EMBED_MODEL=nomic-embed-text  # Embedding model (default)
```

**Key Benefits**:

- **Contextual Responses**: AI aware of previous conversations via semantic search
- **Smart Routing**: "What is theme park?" → conversation, "Switch theme" → command
- **Token Efficiency**: Only top-k relevant context (~1500 tokens) vs full history
- **Non-Blocking**: Embedding generation doesn't delay transcription save

See [RAG System Guidelines](.github/instructions/rag-system.instructions.md) for detailed implementation patterns.

## Browser Compatibility

- Web Speech API required (Chrome, Edge, Safari)
- Check `isSupported` flags before initializing services
- Handle unsupported browsers gracefully

## Adding New Features

**Feature-Based Development**: Follow the established pattern

1. Create feature folder structure in `src/features/{feature-name}/`:

   ```
   {feature-name}/
     components/        # UI components
     hooks/             # React hooks
     services/          # Business logic (if needed)
     types/             # TypeScript definitions
     config/            # Configuration (if needed)
     index.ts           # Barrel export
   ```

2. Define types in `src/features/{feature-name}/types/`:
   - Create focused type files (e.g., `models.ts`, `state.ts`)
   - Add barrel export in `index.ts`
   - Keep types self-contained within feature
     features/ai/types/commands.ts`
3. Define command in `backend/src/config/commandRegistry.ts`:
   - Set category for intent classification
   - Add keywords for client-side detection
   - Provide description and examples
   - Define parameter schema if needed
4. Add app feature to `backend/src/config/appKnowledgeBase.ts` (if new feature area):
   - Semantic description for intent routing
   - Related command keywords
   - See [RAG System Guidelines](.github/instructions/rag-system.instructions.md#adding-new-features)
5. Create handler in `src/features/ai/services/handlers/`:
   - Handler dispatches Redux actions via `context.dispatch()`
   - Register in `src/features/ai/services/handlerRegistry.ts`
6. Create component:
   - Pure presentation, no direct service imports
   - Use `useAppColors()` for theme-aware styling
   - Place in `components/` folder

7. Add barrel export in `{feature-name}/index.ts`:

   ```typescript
   export * from './components/MyComponent';
   export * from './hooks/useMyFeature';
   export * from './types';
   ```

8. Integrate in `src/App.tsx`:
   - Import from feature: `import { MyComponent, useMyFeature } from './features/{feature-name}'`
   - Wire up hooks to components via props

**Cross-Feature Communication**:

- Speech feature exports `Transcription` type used by AI feature
- AI feature imports speech types: `import { Transcription } from '../../speech/types/transcription'`
- Keep cross-feature dependencies minimal and explicit

## Adding New Commands

1. Add `CommandAction` enum value in **both** `backend/src/types/index.ts` and `src/features/ai/types/commands.ts`
2. Define command in `backend/src/config/commandRegistry.ts`:
   - Set category for intent classification
   - Add keywords for detection
   - Provide description and examples
   - Define parameter schema if needed
3. Add app feature to `backend/src/config/appKnowledgeBase.ts` (if new feature area):
   - Semantic description for intent routing (optimized for embeddings)
   - Restart backend to regenerate feature embeddings
   - See [RAG System Guidelines](.github/instructions/rag-system.instructions.md#adding-new-features)
4. Create or update a handler file in `src/features/ai/services/handlers/`:
   - Handler receives `(command: Command, context: CommandExecutionContext)`
   - Dispatches Redux action via `context.dispatch()`
5. Register handler in `src/features/ai/services/handlerRegistry.ts`:
   - Map `CommandAction` to handler function
6. Add Redux slice action if new state is needed:
   - Create or update slice in `src/store/slices/`

**Note**: `CommandExecutionContext` only contains `{ dispatch: AppDispatch }`. No callbacks — all state changes go through Redux dispatch.

## Performance Considerations

**Ollama API Optimization**:

- **Three-Mode Routing**: Backend routes to `💬 general`, `📚 app-info`, or `⚡ commands` before Ollama call
- **Never** make multiple Ollama calls for the same user input (single `POST /api/ai/query`)
- **Feature Embeddings**: Cached on backend startup (~5-10s one-time cost), invalidated on model switch
- **Batch Processing**: Handle multiple commands from single input efficiently
- **RAG Context**: Only top-3 relevant transcriptions (~1500 tokens) vs full history
- **Informational Query Detection**: `hasInformationalIntent()` patterns route to `📚 app-info` mode

**State Management**:

- Use `useRef` for service instances (not state—prevents unnecessary re-renders)
- Use `useCallback` for event handlers to maintain referential equality
- Use specific Redux selectors (`useAppSelector(state => state.slice.field)`) to minimize re-renders
- Avoid selecting entire Redux store

**Redux Persist / Storage**:

- Transcription history bounded (don't let it grow unbounded)
- Embeddings (`number[]`) stored on transcriptions (~3KB each) — acceptable at 100 items
- Handle `QuotaExceededError` gracefully (prune oldest items)
- Non-blocking: embedding generation happens async after save
