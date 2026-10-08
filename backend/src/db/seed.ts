/**
 * Demo Directory Seed
 *
 * Upserts the coaches and clients that the mock Grain sample calls refer
 * to. Safe to re-run. All clients post to SLACK_DEMO_CHANNEL_ID (change
 * per client in the clients table for a real workspace).
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
  },
  {
    name: 'Priya Shah',
    email: 'priya@northwind.example',
    coachEmail: 'dana@coaching.example',
    titleKeywords: ['northwind'],
  },
  {
    name: 'Jordan Kim',
    email: 'jordan@globex.example',
    coachEmail: 'sam@coaching.example',
    titleKeywords: ['globex'],
  },
];

const seed = async (): Promise<void> => {
  const channelId = getDefaultClientChannel();

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
        [c.name, c.email, c.coachEmail, channelId, c.titleKeywords],
      );
    }
  });

  console.log(
    `✅ Seeded ${COACHES.length} coaches and ${CLIENTS.length} clients (Slack channel ${channelId})`,
  );
};

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);
