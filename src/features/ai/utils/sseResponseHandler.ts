import { CommandBatch } from '../types';
import { Transcription } from '../../ai/types/transcription';
import { BackendService } from '../services/backendService';
import { createLogger } from '../../logging';

const logger = createLogger('ai');

export interface SSEResponse {
  commandBatch: CommandBatch | null;
  mode: string;
  error: Error | null;
}

export const handleSSEResponse = async (
  backendService: ReturnType<typeof BackendService>,
  text: string,
  history: Transcription[],
  image: string | null | undefined,
  onThinking: (chunk: string) => void,
  onComplete: (mode: string) => void,
): Promise<SSEResponse> => {
  let commandBatch: CommandBatch | null = null;
  let mode: string = '';
  let sseError: Error | null = null;

  await backendService.queryWithStreaming(
    text,
    history,
    image,
    (thinkingChunk: string) => {
      onThinking(thinkingChunk);
    },
    (result) => {
      logger.info('✅ Backend response received');

      if (result.commandBatch) {
        commandBatch = result.commandBatch;
      } else if (result.command) {
        commandBatch = {
          commands: [result.command],
          interpretation: result.command.interpretation,
          aiResponse: result.command.aiResponse,
        };
      }

      mode = result.mode;
      onComplete(mode);
    },
    (error) => {
      sseError = error;
    },
  );

  return { commandBatch, mode, error: sseError };
};
