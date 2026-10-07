/**
 * Integration Outbox Repository
 *
 * What the mock Slack and Drive connectors "sent" and "saved", so the
 * dashboard can show it. A repeated idempotency key returns the stored
 * row instead of writing a duplicate.
 */

import { query } from './index';

export type OutboxService = 'slack' | 'drive';

export interface OutboxItem {
  id: string;
  service: OutboxService;
  target: string;
  title: string;
  payload: Record<string, unknown>;
  external_id: string;
  idempotency_key: string | null;
  created_at: Date;
}

export interface OutboundRecord {
  service: OutboxService;
  target: string;
  title: string;
  payload: Record<string, unknown>;
  externalId: string;
  idempotencyKey?: string;
}

export const recordOutbound = async (
  record: OutboundRecord,
): Promise<OutboxItem> => {
  const inserted = await query<OutboxItem>(
    `insert into integration_outbox
       (service, target, title, payload, external_id, idempotency_key)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (idempotency_key) do nothing
     returning *`,
    [
      record.service,
      record.target,
      record.title,
      JSON.stringify(record.payload),
      record.externalId,
      record.idempotencyKey ?? null,
    ],
  );
  if (inserted[0]) return inserted[0];

  return (
    await query<OutboxItem>(
      'select * from integration_outbox where idempotency_key = $1',
      [record.idempotencyKey],
    )
  )[0];
};

export interface OutboxFilters {
  service?: OutboxService | null;
  target?: string | null;
  limit?: number;
}

/** Newest first; Drive HTML is left out of the list (see getOutboxItem) */
export const listOutbox = ({
  service = null,
  target = null,
  limit = 200,
}: OutboxFilters = {}): Promise<OutboxItem[]> =>
  query<OutboxItem>(
    `select id, service, target, title, payload - 'html' as payload,
            external_id, idempotency_key, created_at
       from integration_outbox
      where ($1::text is null or service = $1)
        and ($2::text is null or target = $2)
      order by created_at desc
      limit $3`,
    [service, target, limit],
  );

export const getOutboxItem = async (id: string): Promise<OutboxItem | null> =>
  (
    await query<OutboxItem>('select * from integration_outbox where id = $1', [
      id,
    ])
  )[0] ?? null;

/** The outbox entry behind a stored Slack ts or Drive file ID */
export const findOutboxIdByExternalId = async (
  service: OutboxService,
  externalId: string | null,
): Promise<string | null> =>
  externalId
    ? ((
        await query<{ id: string }>(
          `select id from integration_outbox
            where service = $1 and external_id = $2
            order by created_at desc limit 1`,
          [service, externalId],
        )
      )[0]?.id ?? null)
    : null;
