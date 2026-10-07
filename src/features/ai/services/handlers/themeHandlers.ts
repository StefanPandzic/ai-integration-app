import { Command, CommandResult, CommandExecutionContext } from '../../types';
import { createLogger } from '../../../logging';
import {
  toggleColorMode as toggleColorModeAction,
  setColorMode,
} from '../../../../store/slices/appSlice';

const logger = createLogger('ai');

export const toggleTheme = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  // Dispatch Redux action to toggle theme
  context.dispatch(toggleColorModeAction());
  logger.info('🎨 Theme toggled');

  return {
    success: true,
    message: 'Theme toggled',
    command,
  };
};

export const setTheme = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const targetTheme = command.parameters?.theme;

  if (!targetTheme) {
    return {
      success: false,
      message: 'No theme specified',
      command,
      error: 'Theme parameter is required',
    };
  }

  // Dispatch Redux action to set specific theme
  context.dispatch(setColorMode(targetTheme));
  logger.info(`🎨 Theme set to ${targetTheme}`);

  return {
    success: true,
    message: `Theme set to ${targetTheme} mode`,
    command,
  };
};
