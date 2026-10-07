---
name: add-voice-command
description: Add a new voice command end to end (backend type, command registry, frontend handler, handler registry). Use when asked to add or change a voice command.
argument-hint: command name and description
---

# Add Voice Command

Add the command described in `$ARGUMENTS`. First decide whether it takes parameters and which domain it belongs to (theme, language, transcription, app text, production). Reuse an existing handler file and Redux slice where one fits.

## Steps

1. Add the `CommandAction` value in **both** `backend/src/types/index.ts` and `src/features/ai/types/commands.ts`.
2. Add an entry to `COMMAND_REGISTRY` in `backend/src/config/commandRegistry.ts` with a description, keywords, examples and a parameter schema if it takes parameters.
3. If the command opens a new feature area, add a semantic description to `APP_FEATURES` in `backend/src/config/appKnowledgeBase.ts`. The backend must restart to re-embed.
4. Add a handler `(command, context) => ...` in `src/features/ai/services/handlers/<domain>Handlers.ts`. It validates the parameters (see `utils/commandValidation.ts`) and calls `context.dispatch(...)`.
5. Register the handler in `src/features/ai/services/handlerRegistry.ts`.
6. Add a slice action in `src/store/slices/` only if new state is needed.

## Verify

- Run `npm run build` and `cd backend && npm run type-check`.
- Say the command. The backend log should show `⚡ commands` mode and the new action, and the UI should update.
- Check that an unrelated question with similar wording still routes to `💬 general`.
