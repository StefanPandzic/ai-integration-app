/**
 * Call Summary → standalone HTML document (the Google Drive copy)
 *
 * Same look as the report documents; all model text is escaped.
 */

import { getDashboardUrl } from '../../config/integrations';
import { CallSummary } from '../../schemas/callSummary';
import { CallRow, ClientRow, CoachRow } from '../../types/pipeline';
import { escapeHtml, list, page, stat } from '../reports/renderReport';

const callDate = (call: CallRow): string =>
  new Date(call.started_at ?? call.created_at).toISOString().slice(0, 10);

/** Drive location: Calls/<Client>/<YYYY-MM>, titled "<YYYY-MM-DD> <title>" */
export const callDocumentPath = (call: CallRow, client: ClientRow) => ({
  folderPath: `Calls/${client.name}/${callDate(call).slice(0, 7)}`,
  title: `${callDate(call)} ${call.title ?? 'Coaching call'}`,
});

export const renderCallSummaryHtml = (
  call: CallRow,
  summary: CallSummary,
  client: ClientRow,
  coach: CoachRow,
): string => {
  const minutes = call.duration_seconds ? Math.round(call.duration_seconds / 60) : null;
  const stats = `<div class="stats">${[
    stat('Date', callDate(call)),
    stat('Duration', minutes === null ? 'n/a' : `${minutes} min`),
    stat('Client sentiment', summary.client_sentiment),
    stat('Action items', summary.action_items.length),
  ].join('')}</div>`;

  const actionItems =
    summary.action_items.length > 0
      ? `<table><tr><th>Owner</th><th>Task</th><th>Due</th></tr>${summary.action_items
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.owner)} <span class="muted">(${item.owner_role})</span></td><td>${escapeHtml(item.task)}</td><td>${escapeHtml(item.due ?? '')}</td></tr>`,
          )
          .join('')}</table>`
      : '<p class="muted">None.</p>';

  const quotes =
    summary.notable_quotes.length > 0
      ? summary.notable_quotes
          .map((q) => `<blockquote>“${escapeHtml(q.quote)}” — ${escapeHtml(q.speaker)}</blockquote>`)
          .join('')
      : '<p class="muted">None.</p>';

  const body = `${stats}<p>${escapeHtml(summary.overview)}</p>
<h2>Key points</h2>${list(summary.key_points)}
<h2>Action items</h2>${actionItems}
<h2>Risks</h2>${list(summary.risks)}
<h2>Notable quotes</h2>${quotes}
<p class="muted">Participants: ${escapeHtml(call.participants.map((p) => p.name).join(', '))}. <a href="${getDashboardUrl()}/calls/${encodeURIComponent(call.id)}">Open in dashboard</a></p>`;

  return page(
    call.title ?? 'Coaching call',
    `${client.name} with ${coach.name} · ${callDate(call)}`,
    body,
  );
};
