---
description: 'Add a new voice command to the speech-to-text app. Follows the established pattern: backend type → command registry → frontend handler → handler registry.'
argument-hint: 'command name and description'
---

# Add Voice Command

Add a new voice command to the speech-to-text application. The backend interprets all commands; the frontend executes them via Redux dispatch.

## Architecture Reminder

- **Backend** (`backend/src/`) — defines command types, command registry, prompt building, Ollama call
- **Frontend** (`src/features/ai/`) — executes commands via handler registry + Redux dispatch
- `CommandExecutionContext` contains **only** `{ dispatch: AppDispatch }` — no raw callbacks
- All state changes go through Redux slice actions

## Pre-Implementation Reasoning

**Think Before Coding**: Analyze command requirements and implications

**Required Analysis**:

1. **Command Type Classification**:

   ```
   Question: What kind of command is this?
   Thinking:
   - Boolean action? (e.g., "toggle", "clear") → No parameters
   - Parameterized action? (e.g., "set theme to dark") → Requires validation
   - State-dependent action? (e.g., "undo last") → Read Redux state in handler
   - Batch-able action? (e.g., "enable lines 1 and 2") → Already supported via CommandBatch
   ```

2. **Feature Area Identification**:

   ```
   Question: Where does this command belong?
   Thinking:
   - Theme/appearance? → themeHandlers.ts, existing Redux appSlice
   - Production control? → productionHandlers.ts, existing productionSlice
   - Transcription management? → transcriptionHandlers.ts, existing transcriptionSlice
   - New feature area? → new handler file + new Redux slice + appKnowledgeBase.ts entry
   ```

3. **Execution Impact**:

   ```
   Question: What Redux actions are dispatched?
   Thinking:
   - Which slice owns this state? (appSlice / productionSlice / transcriptionSlice / commandSlice)
   - Does it need a new slice action, or does one already exist?
   - No callbacks needed — dispatch is the only tool
   ```

4. **RAG Routing Consideration**:
   ```
   Question: Will this command route correctly in the backend?
   Thinking:
   - Does an existing APP_FEATURES entry cover this semantically?
   - Example: "restart session" → probably covered by 'transcription' feature
   - If new concept: Add entry to backend/src/config/appKnowledgeBase.ts
   - Test: Will general questions about this topic trigger false positives?
   - Restart backend after appKnowledgeBase.ts changes to regenerate feature embeddings
   ```

**Example Pre-Analysis**:

```
User Request: "Add command to pause production line"

Thinking:
1. Command Type: Parameterized action (lineId required)
2. Feature Area: Production control → productionHandlers.ts + productionSlice
3. Parameters: lineId (1-3, required)
4. State Impact:
   - Dispatch pauseLine(lineId) action to productionSlice
   - No impact on speech/ai features
5. Context: dispatch only — no new callbacks
6. RAG Routing:
   - Existing 'production-lines' feature description covers this
   - High similarity expected for "pause line X" queries
7. Validation: Ensure lineId is valid (1-3) inside handler
8. Edge Cases: What if already paused? (idempotent, let Redux handle)
```

## Instructions

Follow these steps in order:

### 1. Define Command Action (Backend + Frontend)

**Backend** — add to `CommandAction` enum in [backend/src/types/index.ts](../backend/src/types/index.ts):

```typescript
export enum CommandAction {
  // ... existing commands
  YOUR_NEW_COMMAND = 'YOUR_NEW_COMMAND',
}
```

If the command needs new parameters, add them to `CommandParameters`:

```typescript
export interface CommandParameters {
  // ... existing fields
  yourNewParameter?: string;
}
```

**Frontend** — mirror the same addition in [src/features/ai/types/commands.ts](../src/features/ai/types/commands.ts):

```typescript
export enum CommandAction {
  // ... existing commands
  YOUR_NEW_COMMAND = 'YOUR_NEW_COMMAND',
}
```

And add the parameter to the frontend `Command.parameters` shape if needed.

### 2. Register the Command (Backend)

Add a definition to `COMMAND_REGISTRY` in [backend/src/config/commandRegistry.ts](../backend/src/config/commandRegistry.ts):

```typescript
{
  action: CommandAction.YOUR_NEW_COMMAND,
  category: 'your-category',   // matches an APP_FEATURES id
  keywords: ['your', 'trigger', 'words'],
  description: 'What this command does',
  parameters: [
    { name: 'yourNewParameter', type: 'string', required: false },
  ],
  examples: ['"your example phrase"', '"another trigger"'],
},
```

The `generateCommandPrompt()` function in `commandRegistry.ts` automatically builds the command list injected into `⚡ commands` mode prompts. No manual prompt editing is required.

### 3. Update App Knowledge Base (if new feature area)

If this command covers a concept not yet in [backend/src/config/appKnowledgeBase.ts](../backend/src/config/appKnowledgeBase.ts), add a new entry:

```typescript
{
  id: 'your-feature',
  name: 'Your Feature Name',
  description:
    'Semantic description optimized for embedding similarity. Be specific about what the feature does in the context of this app. Avoid generic words that could match unrelated queries.',
  relatedCommands: [], // Legacy field, leave empty
},
```

Restart the backend after this change — feature embeddings are cached on startup.

### 4. Implement the Handler (Frontend)

Create or update a handler file in `src/features/ai/services/handlers/`. Add a function that receives `(command: Command, context: CommandExecutionContext)` and dispatches a Redux action:

```typescript
// src/features/ai/services/handlers/yourHandlers.ts
import { CommandResult, Command, CommandExecutionContext } from '../../types';
import { yourSliceAction } from '../../../../store/slices/yourSlice';

export const executeYourCommand = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const param = command.parameters?.yourNewParameter;

  if (!param) {
    return {
      success: false,
      message: 'Parameter required',
      command,
      error: 'Missing yourNewParameter',
    };
  }

  context.dispatch(yourSliceAction(param));

  return { success: true, message: 'Command executed', command };
};
```

If an existing handler file covers the same domain (e.g., `themeHandlers.ts` for theme commands), add the function there instead of creating a new file.

### 5. Register the Handler (Frontend)

Add the handler to the registry in [src/features/ai/services/handlerRegistry.ts](../src/features/ai/services/handlerRegistry.ts):

```typescript
import { executeYourCommand } from './handlers/yourHandlers';

export const commandHandlers: Record<CommandAction, CommandHandler> = {
  // ... existing handlers
  [CommandAction.YOUR_NEW_COMMAND]: executeYourCommand,
};
```

### 6. Add Redux State (if needed)

If the command affects state not yet in Redux:

1. Create `src/store/slices/yourSlice.ts` with the appropriate actions
2. Register it in `src/store/index.ts`
3. Add it to Redux Persist configuration if the state should survive page reloads

No changes to `CommandExecutionContext` are needed — it only holds `dispatch`.

### 7. Test the Command

1. **Start backend**: `cd backend && npm run dev`
2. **Start frontend**: `npm run dev`
3. **Backend logs**: Verify `⚡ commands` mode is selected for your trigger phrase
4. **Speak the trigger phrase**: Use voice input
5. **Verify execution**: Confirm Redux state updates (React DevTools Redux tab)
6. **Verify response**: Check AI acknowledgment message in UI
7. **Check network**: One `POST /api/ai/query` SSE call, no additional Ollama calls

## Example: Add "Export Transcriptions" Command

```typescript
// 1a. backend/src/types/index.ts
export enum CommandAction {
  EXPORT_TRANSCRIPTIONS = 'EXPORT_TRANSCRIPTIONS',
}

// 1b. src/features/ai/types/commands.ts (mirror)
export enum CommandAction {
  EXPORT_TRANSCRIPTIONS = 'EXPORT_TRANSCRIPTIONS',
}

// 2. backend/src/config/commandRegistry.ts
{
  action: CommandAction.EXPORT_TRANSCRIPTIONS,
  category: 'transcription',
  keywords: ['export', 'download', 'history'],
  description: 'Export all transcriptions to a file',
  parameters: [],
  examples: ['"export history"', '"download transcriptions"'],
},

// 4. src/features/ai/services/handlers/transcriptionHandlers.ts
export const exportTranscriptions = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  context.dispatch(triggerExport());
  return { success: true, message: 'Export triggered', command };
};

// 5. src/features/ai/services/handlerRegistry.ts
[CommandAction.EXPORT_TRANSCRIPTIONS]: exportTranscriptions,
```

## Common Patterns

**Boolean actions** (no parameters):

- `TOGGLE_THEME`, `CLEAR_TRANSCRIPTION`
- Handler dispatches a single action, no validation needed

**Parameterized actions** (with parameters):

- `SET_THEME`, `CHANGE_LANGUAGE`, `TOGGLE_PRODUCTION_LINE`
- Handler validates parameter, dispatches with payload

**Conditional actions** (state-dependent):

- Read Redux state inside the handler: `const state = store.getState()` or pass current state via parameter
- Return early with descriptive message if preconditions not met

## Checklist

- [ ] `CommandAction` enum updated in `backend/src/types/index.ts`
- [ ] `CommandAction` enum mirrored in `src/features/ai/types/commands.ts`
- [ ] `CommandParameters` updated in `backend/src/types/index.ts` (if new parameter)
- [ ] Command definition added to `backend/src/config/commandRegistry.ts`
- [ ] `appKnowledgeBase.ts` updated (if new feature area) + backend restarted
- [ ] Handler function implemented in `src/features/ai/services/handlers/`
- [ ] Handler registered in `src/features/ai/services/handlerRegistry.ts`
- [ ] Redux slice action added (if new state needed)
- [ ] Tested with voice input — backend logs show `⚡ commands` mode
- [ ] Verified single `POST /api/ai/query` call
- [ ] AI response is contextually appropriate
