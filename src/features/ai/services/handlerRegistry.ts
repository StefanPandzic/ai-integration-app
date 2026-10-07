import {
  Command,
  CommandResult,
  CommandExecutionContext,
  CommandAction,
} from '../types';
import { toggleTheme, setTheme } from './handlers/themeHandlers';
import { clearTranscription } from './handlers/transcriptionHandlers';
import { changeLanguage } from './handlers/languageHandlers';
import { changeAppText } from './handlers/appHandlers';
import {
  toggleProductionLine,
  togglePrinter,
} from './handlers/productionHandlers';

type CommandHandler = (
  command: Command,
  context: CommandExecutionContext,
) => CommandResult;

export const commandHandlers: Record<CommandAction, CommandHandler | null> = {
  [CommandAction.TOGGLE_THEME]: toggleTheme,
  [CommandAction.SET_THEME]: setTheme,
  [CommandAction.CLEAR_TRANSCRIPTION]: clearTranscription,
  [CommandAction.CHANGE_LANGUAGE]: changeLanguage,
  [CommandAction.CHANGE_APP_TEXT]: changeAppText,
  [CommandAction.TOGGLE_PRODUCTION_LINE]: toggleProductionLine,
  [CommandAction.TOGGLE_PRINTER]: togglePrinter,
  [CommandAction.NONE]: null,
};
