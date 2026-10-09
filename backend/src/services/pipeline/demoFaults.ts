/**
 * Demo Faults (mock Grain mode only)
 *
 * "Fail next call" makes the next process_call fail permanently once, so
 * the demo can show the whole failure path: dead job → call marked failed
 * → ops alert → Retry → the call goes through.
 */

import { publishChange } from '../live/liveEvents';
import { NonRetryableError } from '../queue/errors';

let failNextCall = false;

export const setFailNextCall = (enabled: boolean): void => {
  failNextCall = enabled;
  publishChange(['Demo']);
};

export const isFailNextCallArmed = (): boolean => failNextCall;

/** Throws once after the switch is armed */
export const maybeInjectFault = (): void => {
  if (!failNextCall) return;
  failNextCall = false;
  publishChange(['Demo']);
  throw new NonRetryableError('Simulated failure (demo "Fail next call"); press Retry');
};
