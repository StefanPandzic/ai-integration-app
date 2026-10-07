/**
 * LLM smoke check: summarizes a short sample call with structured output.
 * Usage: npm run llm:check                       (primary provider with fallback)
 *        npm run llm:check -- ollama             (force a single provider)
 *        npm run llm:check -- ollama deepseek-r1 (override LLM_SETTINGS.ollamaModel)
 */

import dotenv from 'dotenv';
import { LLM_SETTINGS, LLMProviderName } from '../config/aiModels';
import { callSummarySchema } from '../schemas/callSummary';
import {
  StructuredRequest,
  generateStructured,
  getProvider,
} from '../services/llm';

dotenv.config();

const SAMPLE_TRANSCRIPT = `
Dana (coach): Last week you were going to block two hours each morning for outreach. How did that go?
Marcus (client): Honestly, three out of five days. Wednesday and Thursday got eaten by support tickets.
Dana (coach): That's still progress. What would protect those mornings?
Marcus (client): If I hand tickets to Priya before 11, I think I can hold it. I'll set that up by Friday.
Dana (coach): Good. I'll send you the outreach tracker template today.
Marcus (client): I'm a bit worried the Q3 pipeline won't be enough to hit the target, though.
`.trim();

const run = async (): Promise<void> => {
  const forced = process.argv[2] as LLMProviderName | undefined;
  const ollamaModel = process.argv[3];
  if (ollamaModel) {
    LLM_SETTINGS.ollamaModel = ollamaModel;
  }

  const request: StructuredRequest<typeof callSummarySchema> = {
    task: 'llm-check',
    system:
      'You summarize coaching calls. Only use facts stated in the transcript. Action item owners must be call participants.',
    prompt: `Participants: Dana (coach), Marcus (client)\n\nTranscript:\n${SAMPLE_TRANSCRIPT}`,
    schema: callSummarySchema,
  };

  const result = forced
    ? await getProvider(forced).generateStructured(request)
    : await generateStructured(request);

  console.log(`Provider: ${result.provider} (${result.model})`);
  console.log(`Usage: ${JSON.stringify(result.usage)}`);
  console.log(JSON.stringify(result.data, null, 2));
};

run().catch((error) => {
  console.error('❌ LLM check failed:', error);
  process.exitCode = 1;
});
