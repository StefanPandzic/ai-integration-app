/**
 * Outbox types (mirror backend/src/db/outboxRepo.ts): what the mock
 * Slack and Drive connectors sent and saved
 */

export type OutboxService = 'slack' | 'drive';

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
}

export interface SlackButton {
  type: 'button';
  text: SlackText;
  url?: string;
}

/** The Block Kit subset our builders produce */
export interface SlackBlock {
  type: string;
  text?: SlackText;
  fields?: SlackText[];
  elements?: (SlackText | SlackButton)[];
}

export interface OutboxPayload {
  /** Slack */
  text?: string;
  blocks?: SlackBlock[];
  /** Drive (only in the single-item response) */
  html?: string;
}

export interface OutboxItem {
  id: string;
  service: OutboxService;
  target: string;
  title: string;
  payload: OutboxPayload;
  external_id: string;
  created_at: string;
}

export interface OutboxFilters {
  service?: OutboxService;
  target?: string;
}
