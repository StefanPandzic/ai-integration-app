/**
 * Prompt Builder (Backend)
 *
 * Coordinates mode-specific prompt builders for THREE-MODE voice command system:
 * - 💬 GENERAL QUESTIONS (general knowledge Q&A)
 * - 📚 APP RELATED QUESTIONS (app features with knowledge base)
 * - ⚡ COMMANDS (command detection and execution)
 */

import { generateCommandPrompt } from '../config/commandRegistry';

const OUTPUT_FORMAT_CONVERSATIONAL = `OUTPUT FORMAT (JSON):
{"commands":[{"action":"NONE","parameters":null,"interpretation":"..."}],"interpretation":"...","aiResponse":"..."}

The "aiResponse" field should contain natural conversational text.`;

const OUTPUT_FORMAT_COMMANDS = `OUTPUT FORMAT (JSON):
Single command: {"commands":[{"action":"ACTION_NAME","parameters":{...},"interpretation":"..."}],"interpretation":"...","aiResponse":"..."}
Multiple commands: {"commands":[{...},{...}],"interpretation":"...","aiResponse":"..."}`;

/**
 * Build prompt for general questions mode (💬)
 */
export const buildGeneralQuestionsPrompt = (): string => {
  return `You are a helpful AI assistant for a speech-to-text application.
Mode: 💬 GENERAL QUESTIONS

Your task: Answer questions naturally and provide conversational responses.

${OUTPUT_FORMAT_CONVERSATIONAL}

CRITICAL RULES FOR aiResponse:
1. Write ONLY natural conversational text
2. NO JSON formatting inside aiResponse
3. Be helpful and informative
4. Keep responses concise but complete

EXAMPLES:

Input: "what is theme park?"
Output:
{"commands":[{"action":"NONE","parameters":null,"interpretation":"General knowledge question"}],"interpretation":"Asking about theme parks","aiResponse":"A theme park is an amusement park with themed attractions, rides, and entertainment. Popular examples include Disneyland, Universal Studios, and Six Flags."}`;
};

/**
 * Build prompt for app questions mode (📚)
 */
export const buildAppQuestionsPrompt = (): string => {
  return `You are a helpful AI assistant for a speech-to-text application.
Mode: 📚 APP RELATED QUESTIONS

Your task: Answer questions about this app using the provided feature information.

${OUTPUT_FORMAT_CONVERSATIONAL}

CRITICAL RULES FOR aiResponse:
1. Write ONLY natural conversational text
2. Use the provided app feature information to answer accurately
3. Be specific about app capabilities
4. Reference actual features and their purposes

EXAMPLES:

Input: "Tell me about production lines"
Output:
{"commands":[{"action":"NONE","parameters":null,"interpretation":"Question about app features"}],"interpretation":"Asking about production lines","aiResponse":"This app can control 3 production lines for factory monitoring. You can turn lines on or off using voice commands like 'turn on line 1' or 'disable line 2'. Each line can be activated or deactivated independently."}`;
};

/**
 * Build prompt for commands mode (⚡)
 */
export const buildCommandsPrompt = (commandList: string): string => {
  return `You are a command detection AI for a speech-to-text application.
Mode: ⚡ COMMANDS

Your task: Detect app commands and execute them.

AVAILABLE COMMANDS:
${commandList}
NONE||regular text with no commands

${OUTPUT_FORMAT_COMMANDS}

DETECTION RULES:
1. Detect ALL commands in the input (support multiple commands)
2. Use NONE if NO commands detected
3. Only detect ACTION keywords: "turn on", "toggle", "change", "set", "enable", "disable", "activate", "switch"
4. Extract parameters from user input (lineId, theme, language, etc.)
5. For batch commands, return multiple command objects in the array

CRITICAL RULES FOR aiResponse:
1. Write ONLY natural conversational text
2. NO JSON formatting inside aiResponse
3. Acknowledge the action taken: "Line 1 is now active!"
4. Be concise and confirmatory

EXAMPLES:

Input: "turn on line 1"
Output:
{"commands":[{"action":"TOGGLE_PRODUCTION_LINE","parameters":{"lineId":1},"interpretation":"Enable production line 1"}],"interpretation":"Activate line 1","aiResponse":"Line 1 is now active!"}

Input: "dark mode and clear history"
Output:
{"commands":[{"action":"SET_THEME","parameters":{"theme":"dark"},"interpretation":"Change to dark theme"},{"action":"CLEAR_TRANSCRIPTION","parameters":null,"interpretation":"Clear all history"}],"interpretation":"Set dark theme and clear history","aiResponse":"Switched to dark mode and cleared your history!"}`;
};

/**
 * Inject RAG context from conversation history
 */
export const injectRAGContext = (prompt: string, context?: string): string => {
  if (!context || context.trim().length === 0) {
    return prompt;
  }
  return `${prompt}\n\n--- Recent Conversation History ---\n${context}`;
};

/**
 * Inject app feature context (for 📚 mode)
 */
export const injectAppContext = (
  prompt: string,
  appContext?: string,
): string => {
  if (!appContext || appContext.trim().length === 0) {
    return prompt;
  }
  return `${prompt}\n\n--- App Feature Information ---\n${appContext}\n\nUse this information to answer the user's question accurately.`;
};

/**
 * Build system prompt for THREE-MODE command system
 */
export const buildSystemPrompt = (
  isRegularText: boolean,
  context?: string,
  appContext?: string,
): string => {
  let systemPrompt: string;

  if (isRegularText) {
    const hasAppContext = !!(appContext && appContext.trim().length > 0);
    if (hasAppContext) {
      systemPrompt = buildAppQuestionsPrompt();
    } else {
      systemPrompt = buildGeneralQuestionsPrompt();
    }
  } else {
    const commandList = generateCommandPrompt();
    systemPrompt = buildCommandsPrompt(commandList);
  }

  systemPrompt = injectRAGContext(systemPrompt, context);
  systemPrompt = injectAppContext(systemPrompt, appContext);

  return systemPrompt;
};
