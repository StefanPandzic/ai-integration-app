import { CommandBatch } from '../types';

export const hasValidCommands = (
  batch: CommandBatch | null,
): batch is CommandBatch => {
  return (
    batch !== null &&
    batch.commands !== undefined &&
    batch.commands.length > 0 &&
    batch.commands[0].action !== 'NONE'
  );
};
