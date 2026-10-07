/**
 * Coach report check: generates one coach's weekly report and prints it
 * without saving or delivering anything.
 * Usage: npm run reports:check -- <coachId>               (last full week)
 *        npm run reports:check -- <coachId> 2026-09-28    (week containing the date)
 */

import dotenv from 'dotenv';
import { closePool } from '../db';
import { getCoach } from '../db/directoryRepo';
import { getPeriod } from '../db/reportsRepo';
import { generateCoachReport } from '../services/reports/coachReport';

dotenv.config();

const run = async (): Promise<void> => {
  const [coachId, date] = process.argv.slice(2);
  if (!coachId) {
    throw new Error('Usage: npm run reports:check -- <coachId> [YYYY-MM-DD]');
  }

  const coach = await getCoach(coachId);
  if (!coach) throw new Error(`Coach ${coachId} not found`);
  const period = await getPeriod(date ?? null);

  console.log(`Coach report for ${coach.name}, ${period.periodStart} to ${period.periodEnd}`);
  const report = await generateCoachReport(coach, period);
  console.log(`Status: ${report.status} (${report.provider}/${report.model})`);
  console.log(JSON.stringify(report.content, null, 2));
};

run()
  .catch((error) => {
    console.error('❌ Report check failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);
