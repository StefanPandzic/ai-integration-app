/**
 * Webhook Routes
 *
 * POST /webhooks/grain: verify signature → enqueue → 200. No slow work
 * happens here; duplicates are acknowledged with 200 and ignored.
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { acceptGrainRecording } from '../services/pipeline/ingest';
import {
  SIGNATURE_HEADER,
  verifyGrainSignature,
} from '../services/grain/webhookSignature';

/** Set by the express.json `verify` hook in index.ts */
export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

// Placeholder payload shape until checked against Grain's webhook docs
const grainWebhookSchema = z.object({
  type: z.string().optional(),
  data: z.object({ id: z.string().min(1) }),
});

export const webhooksRouter = Router();

webhooksRouter.post('/grain', async (req: RawBodyRequest, res: Response) => {
  const signature = verifyGrainSignature(
    req.rawBody,
    req.header(SIGNATURE_HEADER),
  );
  if (!signature.valid) {
    console.warn(`🚫 Grain webhook rejected: ${signature.reason}`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const parsed = grainWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Unexpected payload', issues: parsed.error.issues });
    return;
  }

  try {
    const { jobId, duplicate } = await acceptGrainRecording(
      parsed.data.data.id,
      req.body,
    );
    console.log(
      `📨 Grain webhook ${parsed.data.data.id}${duplicate ? ' (duplicate, ignored)' : ''}${signature.skipped ? ' [unsigned, mock mode]' : ''}`,
    );
    res.status(200).json({ ok: true, jobId, duplicate });
  } catch (error) {
    // 5xx makes Grain retry delivery; the idempotency key absorbs repeats
    console.error('❌ Failed to enqueue Grain webhook:', error);
    res.status(500).json({ error: 'Failed to enqueue' });
  }
});
