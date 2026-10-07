import { Command, CommandResult, CommandExecutionContext } from '../../types';
import { createLogger } from '../../../logging';
import {
  toggleLine,
  togglePrinter as togglePrinterAction,
} from '../../../../store/slices/productionSlice';

const logger = createLogger('ai');

interface ValidationError {
  message: string;
  error: string;
}

const validateLineId = (lineId: number | undefined): ValidationError | null => {
  if (!lineId) {
    return {
      message: 'No line ID specified',
      error: 'Line ID parameter is required',
    };
  }

  if (lineId < 1 || lineId > 3) {
    return {
      message: `Invalid line ID: ${lineId}`,
      error: 'Line ID must be 1, 2, or 3',
    };
  }

  return null;
};

export const toggleProductionLine = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const lineId = command.parameters?.lineId;
  const validationError = validateLineId(lineId);

  if (validationError) {
    return {
      success: false,
      message: validationError.message,
      command,
      error: validationError.error,
    };
  }

  context.dispatch(toggleLine(lineId!));
  logger.info(`🏭 Production line ${lineId} toggled`);

  return {
    success: true,
    message: `Production line ${lineId} toggled`,
    command,
  };
};

export const togglePrinter = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const lineId = command.parameters?.lineId;
  const validationError = validateLineId(lineId);

  if (validationError) {
    return {
      success: false,
      message: validationError.message,
      command,
      error: validationError.error,
    };
  }

  context.dispatch(togglePrinterAction(lineId!));
  logger.info(`🖨️ Printer on line ${lineId} toggled`);

  return {
    success: true,
    message: `Printer on line ${lineId} toggled`,
    command,
  };
};
