/**
 * Grain Webhook Signature
 *
 * HMAC-SHA256 of the raw request body with GRAIN_WEBHOOK_SECRET, hex
 * encoded, sent in the `x-grain-signature` header (optionally prefixed
 * with `sha256=`).
 *
 * NOTE: header name and scheme are placeholders until checked against
 * Grain's webhook docs; only this file needs to change.
 */

import crypto from 'crypto';
import { getGrainMode } from './grainConnector';

export const SIGNATURE_HEADER = 'x-grain-signature';

const signPayload = (rawBody: Buffer | string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

export type SignatureCheck =
  | { valid: true; skipped: boolean }
  | { valid: false; reason: string };

export const verifyGrainSignature = (
  rawBody: Buffer | undefined,
  header: string | undefined,
): SignatureCheck => {
  const secret = process.env.GRAIN_WEBHOOK_SECRET;
  if (!secret) {
    // Unsigned webhooks are only acceptable for local mock testing
    return getGrainMode() === 'mock'
      ? { valid: true, skipped: true }
      : { valid: false, reason: 'GRAIN_WEBHOOK_SECRET is not configured' };
  }

  if (!rawBody || !header) {
    return { valid: false, reason: 'Missing body or signature header' };
  }

  const expected = Buffer.from(signPayload(rawBody, secret), 'hex');
  const received = Buffer.from(header.replace(/^sha256=/, ''), 'hex');
  const valid =
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);

  return valid
    ? { valid: true, skipped: false }
    : { valid: false, reason: 'Signature mismatch' };
};
