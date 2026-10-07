import { Command, CommandResult, CommandExecutionContext } from '../../types';
import { setAppTitle, setAppSubtitle } from '../../../../store/slices/appSlice';

export const changeAppText = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const { title, subtitle } = command.parameters || {};

  if (!title && !subtitle) {
    return {
      success: false,
      message: 'No title or subtitle specified',
      command,
      error: 'At least one of title or subtitle is required',
    };
  }

  if (title) context.dispatch(setAppTitle(title));
  if (subtitle) context.dispatch(setAppSubtitle(subtitle));

  const parts: string[] = [];
  if (title) parts.push(`title to "${title}"`);
  if (subtitle) parts.push(`subtitle to "${subtitle}"`);

  return {
    success: true,
    message: `Changed ${parts.join(' and ')}`,
    command,
  };
};
