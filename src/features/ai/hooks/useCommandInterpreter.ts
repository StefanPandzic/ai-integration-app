/**
 * AI Command Interpreter Hook
 *
 * Orchestrates the complete AI command interpretation pipeline:
 * 1. Send text + history to backend (SSE streaming)
 * 2. Backend performs: Intent routing → RAG context → Ollama AI call
 * 3. Receive CommandBatch with detected commands + AI response
 * 4. Execute commands locally (theme, production controls, etc.)
 * 5. Track progress and update UI in real-time
 *
 * Architecture: Backend interprets, Frontend executes
 */
import { useCallback, useRef, useEffect } from 'react';
import { CommandExecutionContext, ProgressCallback } from '../types';
import { Transcription } from '../types/transcription';
import { BackendService } from '../services/backendService';
import { CommandExecutor } from '../services/commandExecutor';
import { createProgressEmitter } from '../utils/progressTracker';
import { handleSSEResponse } from '../utils/sseResponseHandler';
import { hasValidCommands } from '../utils/commandValidation';
import { createLogger } from '../../logging';
import { AppDispatch } from '../../../store';
import {
  setProcessing,
  setCommandResult,
  setCommandError,
} from '../../../store/slices/commandSlice';

const logger = createLogger('ai');

export const useCommandInterpreter = (
  context: CommandExecutionContext,
  dispatch: AppDispatch,
  onProgress?: ProgressCallback,
) => {
  // Services stored in useRef to survive re-renders without re-initialization
  // BackendService: SSE communication with Node.js backend
  const backendServiceRef =
    useRef<ReturnType<typeof BackendService>>(BackendService());
  // CommandExecutor: Local command execution (created on mount/context change)
  const executorRef = useRef<ReturnType<typeof CommandExecutor> | null>(null);

  // Recreate executor when context changes (dispatch is stable, so this only runs when context changes)
  useEffect(() => {
    executorRef.current = CommandExecutor(context);
  }, [context]);

  const interpretAndExecute = useCallback(
    async (text: string, history?: Transcription[], image?: string | null) => {
      if (!text.trim()) return;

      const emitProgress = createProgressEmitter(onProgress);

      dispatch(setProcessing(true));

      try {
        logger.info('📥 Sending query to backend:', text);
        if (image) {
          logger.info('🖼️ Image attached (vision mode)');
        }

        emitProgress(
          'backend-query',
          'Processing via backend...',
          'active',
          'Intent routing + RAG context + AI interpretation',
        );

        // Step 1: Send to backend via SSE (Server-Sent Events)
        // Backend performs: Intent routing → RAG context → Ollama AI call
        // Returns CommandBatch with detected commands + AI response
        const { commandBatch, error: sseError } = await handleSSEResponse(
          backendServiceRef.current,
          text,
          history || [],
          image,
          // Callback: Real-time thinking chunks (for reasoning models like DeepSeek-R1)
          (thinkingChunk) => {
            emitProgress(
              'ai-thinking',
              '🧠 AI Reasoning',
              'active',
              thinkingChunk,
            );
          },
          // Callback: Processing complete
          (mode) => {
            emitProgress(
              'ai-thinking',
              '🧠 AI Reasoning',
              'complete',
              'Reasoning complete',
            );
            emitProgress(
              'backend-query',
              'Processing via backend...',
              'complete',
              `Mode: ${mode}`, // Mode: 'general' | 'app-info' | 'commands'
            );
          },
        );

        if (sseError) throw sseError;

        if (!executorRef.current) {
          throw new Error('Command executor not initialized');
        }

        // Step 2: Check if AI detected actionable commands (not CommandAction.NONE)
        if (hasValidCommands(commandBatch)) {
          emitProgress(
            'command-execution',
            'Executing commands...',
            'active',
            `Processing ${commandBatch.commands.length} command(s)`,
          );

          // Step 3: Execute commands locally in frontend
          // (theme toggle, language change, production line control, etc.)
          const result = executorRef.current.executeBatch(commandBatch);

          emitProgress(
            'command-execution',
            'Executing commands...',
            'complete',
            result.success ? 'Commands executed' : 'Execution failed',
          );

          dispatch(setCommandResult(result));

          return result;
        }

        // No actionable commands, but AI generated a conversational response
        if (commandBatch) {
          const result = {
            success: true,
            message: 'Response generated',
            results: [],
            command: commandBatch,
          };

          dispatch(setCommandResult(result));
          return result;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        logger.error('❌ Error processing command:', errorMessage);
        emitProgress('error', 'Error occurred', 'error', errorMessage);

        dispatch(setCommandError(errorMessage));
      }
    },
    [dispatch, context, onProgress],
  );

  return {
    interpretAndExecute,
  };
};
