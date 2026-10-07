/**
 * Block Kit helpers shared by the message builders
 */

// Block Kit limits
export const HEADER_MAX = 150;
const SECTION_MAX = 3000;

/** Escape mrkdwn control characters in model-generated text */
export const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

export const header = (text: string) => ({
  type: 'header',
  text: { type: 'plain_text', text: clip(text, HEADER_MAX) },
});

export const section = (text: string) => ({
  type: 'section',
  text: { type: 'mrkdwn', text: clip(text, SECTION_MAX) },
});

export const context = (text: string) => ({
  type: 'context',
  elements: [{ type: 'mrkdwn', text: clip(text, SECTION_MAX) }],
});

/** Section with up to 10 two-column fields */
export const fields = (items: [label: string, value: string][]) => ({
  type: 'section',
  fields: items
    .slice(0, 10)
    .map(([label, value]) => ({ type: 'mrkdwn', text: `*${label}*\n${value}` })),
});

export const linkButton = (text: string, url: string) => ({
  type: 'actions',
  elements: [
    { type: 'button', text: { type: 'plain_text', text }, url },
  ],
});

export const bullets = (items: string[]): string =>
  items.map((item) => `• ${escape(item)}`).join('\n');
