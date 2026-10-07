/**
 * JSON Parser Service (Backend)
 *
 * Robust JSON extraction and parsing with error recovery
 * Handles common LLM JSON issues: extra text, thinking tags, trailing commas, etc.
 */

import { Command, CommandBatch } from '../types';

export interface ParseResult {
  success: boolean;
  command?: Command;
  commandBatch?: CommandBatch;
  error?: string;
}

/**
 * Extract and parse command from LLM response with multiple fallback strategies
 */
export const extractAndParseCommand = (response: string): ParseResult => {
  const strategies = [
    // Find JSON between code blocks
    (text: string) => {
      const match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
      return match ? match[1] : text;
    },
    // Find last complete JSON object (greedy from end)
    (text: string) => {
      const matches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      return matches ? matches[matches.length - 1] : text;
    },
    // Original greedy match
    (text: string) => {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? match[0] : text;
    },
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const extracted = strategies[i](response);
      if (!extracted || !extracted.includes('{')) continue;

      // Normalize JSON before parsing
      const normalized = normalizeJSON(extracted);
      const parsed = JSON.parse(normalized);

      // Validate structure
      if (!parsed || typeof parsed !== 'object') continue;

      // Extract command/commandBatch
      if (parsed.commands && Array.isArray(parsed.commands)) {
        if (parsed.commands.length === 1) {
          return {
            success: true,
            command: {
              action: parsed.commands[0].action,
              parameters: parsed.commands[0].parameters || {},
              interpretation: parsed.interpretation || '',
              aiResponse: parsed.aiResponse || '',
            },
          };
        } else if (parsed.commands.length > 1) {
          return {
            success: true,
            commandBatch: {
              commands: parsed.commands.map((cmd: any) => ({
                action: cmd.action,
                parameters: cmd.parameters || {},
              })),
              interpretation: parsed.interpretation || '',
              aiResponse: parsed.aiResponse || '',
            },
          };
        }
      }

      // No commands found but valid JSON - success with no command
      return { success: true };
    } catch (e) {
      // Try next strategy
      continue;
    }
  }

  // All strategies failed
  return {
    success: false,
    error: 'Failed to extract valid JSON from response',
  };
};

/**
 * Normalize common LLM JSON formatting issues
 */
const normalizeJSON = (json: string): string => {
  return (
    json
      // Remove trailing commas before closing braces/brackets
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix single quotes to double quotes (but not in strings)
      .replace(/:\s*'([^']*)'/g, ':"$1"')
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Trim whitespace
      .trim()
  );
};
