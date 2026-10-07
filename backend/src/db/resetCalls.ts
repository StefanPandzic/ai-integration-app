/**
 * Reset Calls
 *
 * Deletes all calls, call summaries, jobs and mock Grain recordings so the
 * pipeline starts empty.
 * Coaches, clients and reports are kept.
 * Usage: npm run db:reset-calls
 */

import dotenv from 'dotenv';
import { closePool, withTransaction } from './index';

dotenv.config();

const reset = async (): Promise<void> => {
  const counts = await withTransaction(async (client) => {
    const jobs = await client.query('delete from jobs');
    // call_summaries cascade from calls
    const calls = await client.query('delete from calls');
    // Otherwise the next reconcile would re-ingest the mock recordings
    const recordings = await client.query('delete from mock_grain_recordings');
    return {
      calls: calls.rowCount ?? 0,
      jobs: jobs.rowCount ?? 0,
      recordings: recordings.rowCount ?? 0,
    };
  });

  console.log(
    `✅ Deleted ${counts.calls} calls, ${counts.jobs} jobs and ${counts.recordings} mock Grain recordings`,
  );
};

reset()
  .catch((error) => {
    console.error('❌ Reset failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);
