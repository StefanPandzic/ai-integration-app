/**
 * Command Registry (Backend)
 *
 * Centralized definitions for all commands
 */

import { CommandAction } from '../types';

export interface CommandDefinition {
  action: CommandAction;
  keywords: string[];
  description: string;
  parameters?: Record<string, string>;
  examples: string[];
}

export const COMMAND_REGISTRY: CommandDefinition[] = [
  {
    action: CommandAction.TOGGLE_THEME,
    keywords: ['theme', 'toggle', 'switch', 'mode'],
    description: 'Switch between light and dark mode',
    examples: ['toggle theme', 'switch theme'],
  },
  {
    action: CommandAction.SET_THEME,
    keywords: ['theme', 'light', 'dark', 'mode', 'color'],
    description: 'Set specific theme',
    parameters: { theme: '"light" | "dark"' },
    examples: ['change to dark mode', 'set light theme'],
  },
  {
    action: CommandAction.CLEAR_TRANSCRIPTION,
    keywords: ['clear', 'delete', 'remove', 'history', 'transcription', 'chat'],
    description: 'Clear all transcription history',
    examples: ['clear history', 'delete all transcriptions'],
  },
  {
    action: CommandAction.CHANGE_LANGUAGE,
    keywords: [
      'language',
      'spanish',
      'french',
      'english',
      'german',
      'translate',
      'speak',
      'serbian',
    ],
    description: 'Change speech recognition language',
    parameters: { language: 'language code (e.g. "es-ES", "fr-FR")' },
    examples: ['switch to Spanish', 'change language to French'],
  },
  {
    action: CommandAction.CHANGE_APP_TEXT,
    keywords: ['title', 'subtitle', 'name', 'heading', 'change', 'rename'],
    description: 'Change app title and/or subtitle',
    parameters: { title: 'string (optional)', subtitle: 'string (optional)' },
    examples: ['change title to My Notes', 'set subtitle to My assistant'],
  },
  {
    action: CommandAction.TOGGLE_PRODUCTION_LINE,
    keywords: [
      'line',
      'production',
      'start',
      'stop',
      'enable',
      'disable',
      'turn',
      'activate',
      'deactivate',
    ],
    description: 'Turn on or off a production line',
    parameters: { lineId: 'number (1, 2, or 3)' },
    examples: ['turn on line 1', 'start production line 2', 'stop line 3'],
  },
  {
    action: CommandAction.TOGGLE_PRINTER,
    keywords: [
      'printer',
      'barcode',
      'print',
      'enable',
      'disable',
      'turn',
      'start',
      'stop',
    ],
    description: 'Turn on or off a barcode printer on a specific line',
    parameters: { lineId: 'number (1, 2, or 3)' },
    examples: ['enable printer on line 1', 'turn off barcode printer 2'],
  },
  {
    action: CommandAction.NONE,
    keywords: [],
    description: 'No command detected (regular transcription)',
    examples: [],
  },
];

/**
 * Generate command list string for prompt
 */
export const generateCommandPrompt = (): string => {
  return COMMAND_REGISTRY.filter((cmd) => cmd.action !== CommandAction.NONE)
    .map((cmd) => {
      const params = cmd.parameters
        ? ` | Parameters: ${Object.entries(cmd.parameters)
            .map(([key, type]) => `${key}: ${type}`)
            .join(', ')}`
        : '';
      return `${cmd.action}||${cmd.description}${params}`;
    })
    .join('\n');
};
