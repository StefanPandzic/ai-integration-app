import { Command, CommandResult, CommandExecutionContext } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../../speech/types/recognition';
import { setSelectedLanguage } from '../../../../store/slices/appSlice';

export const changeLanguage = (
  command: Command,
  context: CommandExecutionContext,
): CommandResult => {
  const targetLanguage = command.parameters?.language;

  if (!targetLanguage) {
    return {
      success: false,
      message: 'No language specified',
      command,
      error: 'Language parameter is required',
    };
  }

  const languageOption = SUPPORTED_LANGUAGES.find(
    (lang) =>
      lang.code.toLowerCase() === targetLanguage.toLowerCase() ||
      lang.label.toLowerCase().includes(targetLanguage.toLowerCase()),
  );

  if (!languageOption) {
    return {
      success: false,
      message: `Language "${targetLanguage}" not supported`,
      command,
      error: `Available languages: ${SUPPORTED_LANGUAGES.map((l) => l.label).join(', ')}`,
    };
  }

  context.dispatch(setSelectedLanguage(languageOption.code));

  return {
    success: true,
    message: `Language changed to ${languageOption.label}`,
    command,
  };
};
