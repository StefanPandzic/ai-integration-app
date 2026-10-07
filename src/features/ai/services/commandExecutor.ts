/**
 * Command Executor Service
 *
 * Executes AI-interpreted commands locally in the frontend.
 * Uses handler registry pattern for clean separation of command logic.
 *
 * Flow:
 * 1. Receive CommandBatch from backend AI interpretation
 * 2. Look up handler for each command action
 * 3. Execute handler with command + execution context (callbacks)
 * 4. Return BatchCommandResult with success/failure status
 *
 * Note: Backend interprets, Frontend executes
 */
import {
  Command,
  CommandAction,
  CommandResult,
  CommandBatch,
  BatchCommandResult,
  CommandExecutionContext,
} from '../types';
import { commandHandlers } from './handlerRegistry';
import { createLogger } from '../../logging';

const logger = createLogger('ai');

export const CommandExecutor = (context: CommandExecutionContext) => {
  // Execute a single command by looking up and calling its handler
  const execute = (command: Command): CommandResult => {
    try {
      const handler = commandHandlers[command.action];

      if (!handler) {
        // CommandAction.NONE indicates AI didn't detect any actionable command
        if (command.action === CommandAction.NONE) {
          return {
            success: false,
            message: 'No command detected',
            command,
          };
        }

        // Unrecognized action (should not happen if registry is complete)
        return {
          success: false,
          message: 'Unknown command',
          command,
          error: `Unrecognized action: ${command.action}`,
        };
      }

      // Call handler with command parameters and execution context (callbacks)
      return handler(command, context);
    } catch (error) {
      return {
        success: false,
        message: 'Command execution failed',
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // Execute multiple commands sequentially (batch processing)
  // Example: "Turn on line 1 and enable printer 2" → 2 commands executed
  const executeBatch = (commandBatch: CommandBatch): BatchCommandResult => {
    logger.debug(
      `🔧 Executing batch of ${commandBatch.commands.length} command(s)`,
    );

    // Execute each command and collect results
    const results: CommandResult[] = commandBatch.commands.map((command) => {
      try {
        return execute(command);
      } catch (error) {
        logger.error(`❌ Failed to execute command ${command.action}:`, error);
        return {
          success: false,
          message: `Failed to execute ${command.action}`,
          command,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Calculate overall success (all must succeed for batch to succeed)
    const overallSuccess = results.every((result) => result.success);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    const message = overallSuccess
      ? `All ${results.length} command(s) executed successfully`
      : `${successCount} command(s) succeeded, ${failCount} failed`;

    logger.info(`✅ Batch execution complete: ${message}`);

    return {
      success: overallSuccess,
      message,
      results,
      command: commandBatch,
    };
  };

  return {
    execute,
    executeBatch,
  };
};
