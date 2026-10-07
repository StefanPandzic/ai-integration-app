/**
 * Call Summary Eval
 *
 * Runs summarizeCall (the production path, including the owner check and
 * the corrective retry) on every mock Grain sample and scores the action
 * items against the answer key in sampleCalls.ts. No database; nothing is
 * saved or posted.
 *
 * Per sample:
 * - schema: the summary was produced and passed zod validation
 * - recall: required expected items that were extracted (keyword match)
 * - owner accuracy: matched items with the expected owner
 * - made up: items matching no expected item whose content words are
 *   mostly absent from the transcript. Items matching no expected item but
 *   grounded in the transcript are reported as "extra" (not a failure)
 *
 * Exit code 1 on any schema failure, made-up item or owner mismatch.
 *
 * Usage: npm run eval
 *        npm run eval -- ollama                force a provider (no fallback)
 *        npm run eval -- --json results.json  also write the raw results
 */

import dotenv from 'dotenv';
import fs from 'fs';
import { LLM_SETTINGS, LLMProviderName } from '../config/aiModels';
import { ActionItem } from '../schemas/callSummary';
import {
  ExpectedActionItem,
  SAMPLE_CALLS,
  SampleCall,
} from '../services/grain/sampleCalls';
import { summarizeCall } from '../services/pipeline/summarizeCall';
import { CallRow, ClientRow, CoachRow } from '../types/pipeline';

dotenv.config();

const COACH_EMAIL_DOMAIN = '@coaching.example';
/** Share of an unmatched item's content words that must appear in the transcript */
const GROUNDED_SHARE = 0.5;

const STOPWORDS = new Set([
  'about', 'after', 'before', 'their', 'there', 'these', 'this', 'that', 'with',
  'will', 'would', 'should', 'could', 'from', 'into', 'your', 'them', 'they',
  'have', 'next', 'week', 'call', 'session', 'what', 'when', 'which', 'also',
]);

interface ItemResult {
  owner: string;
  task: string;
  verdict: 'matched' | 'wrong_owner' | 'extra' | 'made_up';
  expectedOwner?: string;
}

interface SampleResult {
  sampleId: string;
  ok: boolean;
  schemaValid: boolean;
  error?: string;
  provider?: string;
  model?: string;
  ms: number;
  required: number;
  found: number;
  matched: number;
  ownerCorrect: number;
  madeUp: number;
  extra: number;
  missing: string[];
  items: ItemResult[];
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

const matchesKeywords = (task: string, expected: ExpectedActionItem): boolean => {
  const text = task.toLowerCase();
  return expected.keywords.every((group) =>
    group.split('|').some((alternative) => text.includes(alternative)),
  );
};

const groundedShare = (task: string, transcript: string): number => {
  const content = words(task);
  if (content.length === 0) return 1;
  const haystack = new Set(words(transcript));
  // Prefix match tolerates inflection ("draft" / "drafted")
  const present = content.filter((w) =>
    [...haystack].some((h) => h.startsWith(w.slice(0, 5)) || w.startsWith(h.slice(0, 5))),
  );
  return present.length / content.length;
};

/** In-memory rows: the coach is the participant on the coaching domain */
const buildRows = (sample: SampleCall): { call: CallRow; coach: CoachRow; client: ClientRow } => {
  const coachP =
    sample.participants.find((p) => p.email?.endsWith(COACH_EMAIL_DOMAIN)) ??
    sample.participants[0];
  const clientP = sample.participants.find((p) => p !== coachP) ?? sample.participants[1];
  const now = new Date();
  return {
    coach: { id: 'eval-coach', name: coachP.name, email: coachP.email ?? '', slack_user_id: null },
    client: {
      id: 'eval-client',
      name: clientP.name,
      email: clientP.email,
      coach_id: 'eval-coach',
      slack_channel_id: '#eval',
      title_keywords: [],
    },
    call: {
      id: `eval-${sample.id}`,
      grain_recording_id: `eval-${sample.id}`,
      source: 'mock',
      title: sample.title,
      started_at: now,
      duration_seconds: sample.durationSeconds,
      participants: sample.participants,
      transcript: sample.transcript,
      coach_id: 'eval-coach',
      client_id: 'eval-client',
      status: 'received',
      review_reason: null,
      slack_message_ts: null,
      drive_file_id: null,
      drive_url: null,
      created_at: now,
      updated_at: now,
    },
  };
};

/** Owner-correct matches first, then any keyword match (wrong owner) */
const scoreItems = (sample: SampleCall, items: ActionItem[]) => {
  const expected = sample.expectedActionItems;
  const used = new Set<number>();
  const results: (ItemResult | null)[] = items.map(() => null);

  const assign = (requireOwner: boolean) => {
    items.forEach((item, i) => {
      if (results[i]) return;
      const index = expected.findIndex(
        (e, j) =>
          !used.has(j) &&
          matchesKeywords(item.task, e) &&
          (!requireOwner || e.owner === item.owner),
      );
      if (index === -1) return;
      used.add(index);
      results[i] = {
        owner: item.owner,
        task: item.task,
        verdict: requireOwner ? 'matched' : 'wrong_owner',
        expectedOwner: expected[index].owner,
      };
    });
  };
  assign(true);
  assign(false);

  const final: ItemResult[] = items.map(
    (item, i) =>
      results[i] ?? {
        owner: item.owner,
        task: item.task,
        verdict:
          groundedShare(item.task, sample.transcript) >= GROUNDED_SHARE ? 'extra' : 'made_up',
      },
  );
  const missing = expected
    .filter((e, j) => !e.optional && !used.has(j))
    .map((e) => `${e.owner}: ${e.keywords.join(' + ')}`);
  return { final, missing };
};

const evaluate = async (sample: SampleCall): Promise<SampleResult> => {
  const required = sample.expectedActionItems.filter((e) => !e.optional).length;
  const start = Date.now();
  const empty = {
    sampleId: sample.id,
    required,
    found: 0,
    matched: 0,
    ownerCorrect: 0,
    madeUp: 0,
    extra: 0,
    missing: [] as string[],
    items: [] as ItemResult[],
  };

  try {
    const { call, coach, client } = buildRows(sample);
    const result = await summarizeCall(call, coach, client);
    const { final, missing } = scoreItems(sample, result.data.action_items);
    const matched = final.filter((r) => r.verdict === 'matched' || r.verdict === 'wrong_owner');
    const ownerCorrect = final.filter((r) => r.verdict === 'matched').length;
    const madeUp = final.filter((r) => r.verdict === 'made_up').length;
    return {
      ...empty,
      ok: madeUp === 0 && ownerCorrect === matched.length,
      schemaValid: true,
      provider: result.provider,
      model: result.model,
      ms: Date.now() - start,
      found: required - missing.length,
      matched: matched.length,
      ownerCorrect,
      madeUp,
      extra: final.filter((r) => r.verdict === 'extra').length,
      missing,
      items: final,
    };
  } catch (error) {
    return {
      ...empty,
      ok: false,
      schemaValid: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      ms: Date.now() - start,
      missing: sample.expectedActionItems.filter((e) => !e.optional).map((e) => e.owner),
    };
  }
};

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}%`);

const run = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const jsonIndex = args.indexOf('--json');
  const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
  const forced = args.find(
    (a, i) => !a.startsWith('--') && !(jsonIndex >= 0 && i === jsonIndex + 1),
  ) as LLMProviderName | undefined;
  if (forced) {
    LLM_SETTINGS.primary = forced;
    LLM_SETTINGS.fallback = null;
  }

  console.log(
    `Evaluating ${SAMPLE_CALLS.length} samples with ${LLM_SETTINGS.primary}${LLM_SETTINGS.fallback ? ` (fallback ${LLM_SETTINGS.fallback})` : ''}...\n`,
  );

  const results: SampleResult[] = [];
  for (const sample of SAMPLE_CALLS) {
    const result = await evaluate(sample);
    results.push(result);
    console.log(
      `${result.ok ? 'PASS' : 'FAIL'} ${sample.id} (${(result.ms / 1000).toFixed(1)}s${result.provider ? `, ${result.provider}/${result.model}` : ''})`,
    );
    if (result.error) console.log(`     error: ${result.error}`);
    for (const item of result.items) {
      const note =
        item.verdict === 'wrong_owner' ? ` (expected owner ${item.expectedOwner})` : '';
      console.log(`     ${item.verdict.padEnd(11)} ${item.owner}: ${item.task}${note}`);
    }
    for (const m of result.missing) console.log(`     missing     ${m}`);
  }

  const total = (key: 'required' | 'found' | 'matched' | 'ownerCorrect' | 'madeUp' | 'extra') =>
    results.reduce((sum, r) => sum + r[key], 0);
  const schemaValid = results.filter((r) => r.schemaValid).length;

  console.log('\nSummary');
  console.table({
    'schema valid': `${schemaValid}/${results.length}`,
    recall: `${total('found')}/${total('required')} (${pct(total('found'), total('required'))})`,
    'owner accuracy': `${total('ownerCorrect')}/${total('matched')} (${pct(total('ownerCorrect'), total('matched'))})`,
    'made-up items': total('madeUp'),
    'extra (grounded) items': total('extra'),
  });

  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`Raw results written to ${jsonPath}`);
  }

  if (results.some((r) => !r.ok)) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('❌ Eval failed:', error);
  process.exitCode = 1;
});
