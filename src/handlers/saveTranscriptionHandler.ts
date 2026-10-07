import { BackendService } from '../features/ai';
import { Transcription } from '../features/ai/types/transcription';
import { BatchCommandResult } from '../features/ai/types';
import { ProcessingStep } from '../features/ai/types/processing';
import { createLogger } from '../features/logging';
import { AppDispatch } from '../store';
import {
  addTranscription,
  updateTranscriptionResponse,
  updateTranscriptionEmbedding,
  setIsSaving,
} from '../store/slices/transcriptionSlice';

const logger = createLogger('app');

interface SaveTranscriptionHandlerDeps {
  backendServiceRef: React.MutableRefObject<ReturnType<typeof BackendService>>;
  dispatch: AppDispatch;
  interpretAndExecute: (
    text: string,
    history?: Transcription[],
    image?: string | null,
  ) => Promise<BatchCommandResult | undefined>;
  handleProgress: (step: ProcessingStep) => void;
  history: Transcription[];
  selectedLanguage: string;
  isSaving: boolean;
  image?: string | null;
}

/**
 * 4-Step Pipeline: Save → AI Interpret → Update Response → Generate Embedding
 *
 * Step 1: Save transcription to history (get ID for updates)
 * Step 2: Send to backend for AI interpretation (intent routing + RAG + Ollama)
 * Step 3: Update transcription with AI response
 * Step 4: Generate embedding vector (async, non-blocking)
 */
export const createSaveTranscriptionHandler = (
  deps: SaveTranscriptionHandlerDeps,
) => {
  const {
    backendServiceRef,
    dispatch,
    interpretAndExecute,
    handleProgress,
    history,
    selectedLanguage,
    isSaving,
    image,
  } = deps;

  return async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    // Guard: Prevent concurrent saves during async pipeline
    if (isSaving) {
      logger.warn('⚠️ Save already in progress, ignoring duplicate request');
      return;
    }

    // ========================================================================
    // STEP 1: Save Transcription to History
    // ========================================================================
    handleProgress({
      id: 'save-transcription',
      label: 'Saving transcription...',
      status: 'active',
    });

    dispatch(setIsSaving(true));

    const transcriptionId = globalThis.crypto.randomUUID();
    const newTranscription: Transcription = {
      id: transcriptionId,
      text: cleanText,
      timestamp: Date.now(),
      language: selectedLanguage,
      aiResponse: '',
      isGeneratingResponse: true,
      embedding: null,
    };

    dispatch(addTranscription(newTranscription));

    handleProgress({
      id: 'save-transcription',
      label: 'Saving transcription...',
      status: 'complete',
      details: 'Saved to history',
    });

    logger.info('✅ Transcription added to history with ID:', transcriptionId);

    try {
      // ======================================================================
      // STEP 2: AI Interpretation & Command Execution
      // ======================================================================
      // Backend pipeline: Intent routing → RAG context → Ollama → Commands
      // Progress callbacks handle real-time UI updates (thinking, completion)
      const interpretResult = await interpretAndExecute(
        cleanText,
        history,
        image,
      );

      logger.info('🔍 Command check result:', interpretResult);

      // ======================================================================
      // STEP 3: Update Transcription with AI Response
      // ======================================================================
      handleProgress({
        id: 'update-response',
        label: 'Updating response...',
        status: 'active',
      });

      const aiResponse = interpretResult?.command?.aiResponse || 'Processed.';
      dispatch(
        updateTranscriptionResponse({ id: transcriptionId, aiResponse }),
      );

      handleProgress({
        id: 'update-response',
        label: 'Updating response...',
        status: 'complete',
        details: 'Response saved',
      });

      // ======================================================================
      // STEP 4: Generate Embedding (Async, Non-Blocking)
      // ======================================================================
      // Used for RAG semantic search over transcription history
      // Runs in background, doesn't block UI
      const embeddingTokens = Math.ceil(cleanText.length / 4);

      handleProgress({
        id: 'generate-embedding',
        label: 'Generating embedding via backend...',
        status: 'active',
        details: `Converting ~${embeddingTokens} tokens to vector space`,
      });

      backendServiceRef.current
        .generateEmbeddings([cleanText])
        .then((embeddings) => {
          const embedding = embeddings[0];
          if (embedding && embedding.length > 0) {
            dispatch(
              updateTranscriptionEmbedding({ id: transcriptionId, embedding }),
            );
            handleProgress({
              id: 'generate-embedding',
              label: 'Generating embedding via backend...',
              status: 'complete',
              details: `${embedding.length}-D vector | ${embeddingTokens} tokens consumed`,
            });
            logger.info(`✅ Embedding generated for ${transcriptionId}`);
          } else {
            handleProgress({
              id: 'generate-embedding',
              label: 'Generating embedding via backend...',
              status: 'error',
              details: 'Empty vector returned',
            });
            logger.warn(`⚠️ Empty embedding returned for ${transcriptionId}`);
          }
        })
        .catch((error) => {
          handleProgress({
            id: 'generate-embedding',
            label: 'Generating embedding via backend...',
            status: 'error',
            details: error.message || 'Embedding failed',
          });
          logger.error('❌ Error generating embedding:', error);
        });
    } catch (error) {
      logger.error('❌ Error during AI processing:', error);
      dispatch(
        updateTranscriptionResponse({
          id: transcriptionId,
          aiResponse: 'Sorry, I encountered an error processing your request.',
        }),
      );
    } finally {
      dispatch(setIsSaving(false));
    }
  };
};
