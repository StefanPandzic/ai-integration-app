/**
 * Demo Directory Seed
 *
 * Upserts the coaches and clients that the mock Grain sample calls refer
 * to. Safe to re-run. Each client posts to its own channel env var
 * (e.g. SLACK_CHANNEL_MARCUS_WEBB), falling back to SLACK_DEMO_CHANNEL_ID.
 * Usage: npm run db:seed
 */

import dotenv from 'dotenv';
import { getDefaultClientChannel } from '../config/integrations';
import { closePool, withTransaction } from './index';

dotenv.config();

const COACHES = [
  { name: 'Dana Lee', email: 'dana@coaching.example' },
  { name: 'Sam Ortiz', email: 'sam@coaching.example' },
];

const CLIENTS = [
  {
    name: 'Marcus Webb',
    email: 'marcus@acme.example',
    coachEmail: 'dana@coaching.example',
    titleKeywords: ['acme'],
    channelEnv: 'SLACK_CHANNEL_MARCUS_WEBB',
  },
  {
    name: 'Priya Shah',
    email: 'priya@northwind.example',
    coachEmail: 'dana@coaching.example',
    titleKeywords: ['northwind'],
    channelEnv: 'SLACK_CHANNEL_PRIYA_SHAH',
  },
  {
    name: 'Jordan Kim',
    email: 'jordan@globex.example',
    coachEmail: 'sam@coaching.example',
    titleKeywords: ['globex'],
    channelEnv: 'SLACK_CHANNEL_JORDAN_KIM',
  },
];

const seed = async (): Promise<void> => {
  const defaultChannel = getDefaultClientChannel();
  const channelOf = (c: (typeof CLIENTS)[number]): string =>
    process.env[c.channelEnv] || defaultChannel;

  await withTransaction(async (client) => {
    for (const coach of COACHES) {
      await client.query(
        `insert into coaches (name, email) values ($1, $2)
         on conflict (email) do update set name = excluded.name`,
        [coach.name, coach.email],
      );
    }

    for (const c of CLIENTS) {
      await client.query(
        `insert into clients (name, email, coach_id, slack_channel_id, title_keywords)
         values ($1, $2, (select id from coaches where email = $3), $4, $5)
         on conflict (email) do update
           set name = excluded.name, coach_id = excluded.coach_id,
               slack_channel_id = excluded.slack_channel_id,
               title_keywords = excluded.title_keywords`,
        [c.name, c.email, c.coachEmail, channelOf(c), c.titleKeywords],
      );
    }
  });

  console.log(`✅ Seeded ${COACHES.length} coaches and ${CLIENTS.length} clients`);
  for (const c of CLIENTS) console.log(`   ${c.name} → Slack channel ${channelOf(c)}`);
};

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);
