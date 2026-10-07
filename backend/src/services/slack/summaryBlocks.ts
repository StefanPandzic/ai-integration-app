/**
 * Call Summary → Slack Block Kit
 */

import { CallSummary } from '../../schemas/callSummary';
import { CallRow, ClientRow, CoachRow } from '../../types/pipeline';
import { SlackMessage } from './slackClient';

// Block Kit limits
const HEADER_MAX = 150;
const SECTION_MAX = 3000;

const SENTIMENT_EMOJI: Record<CallSummary['client_sentiment'], string> = {
  positive: ':large_green_circle:',
  neutral: ':white_circle:',
  mixed: ':large_yellow_circle:',
  negative: ':red_circle:',
};

/** Escape mrkdwn control characters in model-generated text */
const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const section = (text: string) => ({
  type: 'section',
  text: { type: 'mrkdwn', text: clip(text, SECTION_MAX) },
});

const bullets = (items: string[]): string =>
  items.map((item) => `• ${escape(item)}`).join('\n');

export const buildSummaryMessage = (
  call: CallRow,
  summary: CallSummary,
  client: ClientRow,
  coach: CoachRow,
): SlackMessage => {
  const title = call.title ?? 'Coaching call';
  const date = (call.started_at ?? call.created_at).toISOString().slice(0, 10);
  const minutes = call.duration_seconds
    ? ` · ${Math.round(call.duration_seconds / 60)} min`
    : '';

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: clip(`📞 ${title}`, HEADER_MAX) },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${escape(client.name)}* with ${escape(coach.name)} · ${date}${minutes}`,
        },
      ],
    },
    section(escape(summary.overview)),
  ];

  if (summary.key_points.length > 0) {
    blocks.push(section(`*Key points*\n${bullets(summary.key_points)}`));
  }

  if (summary.action_items.length > 0) {
    const items = summary.action_items
      .map(
        (item) =>
          `• *${escape(item.owner)}* (${item.owner_role}): ${escape(item.task)}${item.due ? ` _(due ${escape(item.due)})_` : ''}`,
      )
      .join('\n');
    blocks.push(section(`*Action items*\n${items}`));
  }

  const sentiment = `*Client sentiment:* ${SENTIMENT_EMOJI[summary.client_sentiment]} ${summary.client_sentiment}`;
  blocks.push(
    section(
      summary.risks.length > 0
        ? `${sentiment}\n*Risks*\n${bullets(summary.risks)}`
        : sentiment,
    ),
  );

  if (summary.notable_quotes.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push(
      section(
        summary.notable_quotes
          .map((q) => `> “${escape(q.quote)}” — ${escape(q.speaker)}`)
          .join('\n'),
      ),
    );
  }

  return {
    channel: client.slack_channel_id,
    text: `Call summary: ${title} (${client.name})`,
    blocks,
  };
};
