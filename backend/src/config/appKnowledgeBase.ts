/**
 * App Knowledge Base (Backend)
 *
 * Core feature descriptions for intent routing via semantic similarity
 */

export interface AppFeature {
  id: string;
  name: string;
  description: string;
  relatedCommands: string[];
}

export const APP_FEATURES: AppFeature[] = [
  {
    id: 'theme',
    name: 'Theme & Appearance',
    description:
      'Toggle user interface color scheme between light mode and dark mode. Switch visual theme settings by voice command. Change application display theme instantly.',
    relatedCommands: [
      'toggle theme',
      'switch theme',
      'change theme',
      'dark mode',
      'light mode',
    ],
  },
  {
    id: 'production-lines',
    name: 'Production Line Control',
    description:
      'Manage manufacturing production lines 1, 2, and 3 for factory monitoring. Turn lines on or off, activate or deactivate production equipment.',
    relatedCommands: [
      'activate line',
      'enable line',
      'disable line',
      'production',
    ],
  },
  {
    id: 'printers',
    name: 'Printer Management',
    description:
      'Control printer devices 1, 2, and 3 for factory output. Enable or disable printers, manage print queue operations.',
    relatedCommands: ['enable printer', 'disable printer', 'activate printer'],
  },
  {
    id: 'language',
    name: 'Language & Recognition',
    description:
      'Change speech recognition language for transcription. Supports English, Spanish, French, German, Chinese, Japanese, and more.',
    relatedCommands: [
      'change language',
      'set language',
      'english',
      'spanish',
      'language',
    ],
  },
  {
    id: 'transcription',
    name: 'Transcription Management',
    description:
      'Edit, save, and clear speech transcriptions and text history. Remove all previous transcriptions from memory and start fresh.',
    relatedCommands: ['clear history', 'clear text', 'delete transcription'],
  },
  {
    id: 'app-text',
    name: 'App Title & Branding',
    description:
      'Change application title and subtitle text. Customize the main heading and tagline displayed at the top of the interface.',
    relatedCommands: ['change title', 'change name', 'set title', 'title'],
  },
  {
    id: 'microphone',
    name: 'Microphone & Audio Input',
    description:
      'Select or change audio input device for speech recognition. Switch between microphones, headsets, or other audio sources.',
    relatedCommands: ['change microphone', 'select microphone', 'audio input'],
  },
  {
    id: 'commands',
    name: 'Voice Command System',
    description:
      'Execute app-specific actions using natural voice input and commands. Control the application entirely through spoken instructions.',
    relatedCommands: ['execute command', 'run command', 'command', 'voice'],
  },
];
