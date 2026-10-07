import { Command, CommandResult, CommandExecutionContext } from '../../types';
import { clearHistory } from '../../../../store/slices/transcriptionSlice';

export const clearTranscription = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  context.dispatch(clearHistory());

  return {
    success: true,
    message: 'All transcription history cleared',
    command,
  };
};
