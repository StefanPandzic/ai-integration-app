/**
 * Report → standalone HTML document (the Google Drive copy)
 *
 * Self-contained (inline CSS) so it renders the same in Drive, a browser
 * or the dashboard's sandboxed preview. All model text is escaped.
 */

import { getDashboardUrl } from '../../config/integrations';
import { CoachReportContent, RUBRIC } from '../../schemas/coachReport';
import { ManagerReportContent, SentimentCounts } from '../../schemas/managerReport';
import { ReportStatus } from '../../types/pipeline';

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STYLE = `
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a202c; max-width: 760px; margin: 32px auto; padding: 0 20px; line-height: 1.5; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 15px; margin: 16px 0 4px; }
  .muted { color: #718096; font-size: 14px; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
  .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; min-width: 110px; }
  .stat b { display: block; font-size: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; border-bottom: 1px solid #edf2f7; padding: 6px 8px; vertical-align: top; }
  a { color: #3182ce; }
`;

const page = (title: string, subtitle: string, body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(subtitle)}</p>${body}</body></html>`;

const stat = (label: string, value: string | number) =>
  `<div class="stat"><b>${escapeHtml(String(value))}</b><span class="muted">${escapeHtml(label)}</span></div>`;

const list = (items: string[]): string =>
  items.length > 0
    ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    : '<p class="muted">None.</p>';

const callLink = (id: string, label: string): string =>
  `<a href="${getDashboardUrl()}/calls/${encodeURIComponent(id)}">${escapeHtml(label)}</a>`;

const formatSentiment = (s: SentimentCounts): string =>
  `${s.positive} positive · ${s.neutral} neutral · ${s.mixed} mixed · ${s.negative} negative`;

const signed = (n: number | null): string =>
  n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n}`;

export const renderCoachReportHtml = (
  coachName: string,
  periodLabel: string,
  status: ReportStatus,
  content: CoachReportContent,
): string => {
  const { stats } = content;
  const title = `Weekly report: ${coachName}`;
  const statsHtml = `<div class="stats">${[
    stat('Calls', stats.calls),
    stat('Clients', stats.clients),
    stat('Rating', stats.rubric_average === null ? 'n/a' : `${stats.rubric_average}/5`),
    stat('Coach talk share', stats.coach_talk_share === null ? 'n/a' : `${Math.round(stats.coach_talk_share * 100)}%`),
    stat('Excluded calls', stats.excluded_calls),
  ].join('')}</div><p class="muted">Client sentiment: ${formatSentiment(stats.sentiment)}. Action items: ${stats.action_items.client} client, ${stats.action_items.coach} coach. Deadlines carried in from earlier weeks: ${stats.overdue_action_items}.</p>`;

  if (status === 'empty') {
    return page(title, periodLabel, `${statsHtml}<p>No summarized calls this week.</p>`);
  }

  const callLabel = new Map(
    content.calls.map((c) => [c.id, `${c.date} · ${c.title ?? 'Call'}`]),
  );
  const rubricLabel = new Map<string, string>(RUBRIC.map((d) => [d.key, d.label]));

  const rating = content.coach_rating
    ? `<h2>Coaching rating</h2><table><tr><th>Dimension</th><th>Score</th><th>Evidence</th></tr>${content.coach_rating.dimensions
        .map(
          (d) =>
            `<tr><td>${escapeHtml(rubricLabel.get(d.key) ?? d.key)}</td><td>${d.score_1_5}/5</td><td>${d.evidence
              .map((e) => `${callLink(e.call_id, callLabel.get(e.call_id) ?? 'Call')}: ${escapeHtml(e.note)}`)
              .join('<br>')}</td></tr>`,
        )
        .join('')}</table><p>${escapeHtml(content.coach_rating.overall_comment)}</p>`
    : '';

  const clients = (content.per_client ?? [])
    .map(
      (s) =>
        `<h3>${escapeHtml(s.client_name)}</h3><p><b>Progress.</b> ${escapeHtml(s.progress)}</p><p><b>Next focus.</b> ${escapeHtml(s.next_focus)}</p>${
          s.watch_outs.length > 0 ? `<p><b>Watch-outs</b></p>${list(s.watch_outs)}` : ''
        }<p class="muted">Based on: ${s.evidence_call_ids
          .map((id) => callLink(id, callLabel.get(id) ?? 'Call'))
          .join(', ')}</p>`,
    )
    .join('');

  return page(
    title,
    periodLabel,
    `${statsHtml}<h2>Pay attention to</h2>${list(content.attention ?? [])}<h2>Clients</h2>${clients}${rating}<h2>Improvements</h2>${list(
      (content.improvements ?? []).map((i) => `${rubricLabel.get(i.dimension) ?? i.dimension}: ${i.suggestion}`),
    )}`,
  );
};

export const renderManagerReportHtml = (
  periodLabel: string,
  status: ReportStatus,
  content: ManagerReportContent,
): string => {
  const { stats } = content;
  const title = 'Weekly manager overview';
  const clientName = (id: string) => content.client_names[id] ?? 'Unknown client';

  const statsHtml = `<div class="stats">${[
    stat('Calls', `${stats.calls} (${signed(stats.deltas.calls)})`),
    stat('Clients', stats.clients),
    stat('Avg rating', stats.rubric_average === null ? 'n/a' : `${stats.rubric_average}/5 (${signed(stats.deltas.rubric_average)})`),
    stat('Negative calls', `${stats.sentiment.negative} (${signed(stats.deltas.sentiment.negative)})`),
    stat('Excluded calls', stats.excluded_calls),
  ].join('')}</div><p class="muted">Client sentiment: ${formatSentiment(stats.sentiment)} (last week: ${formatSentiment(stats.previous.sentiment)}).</p>${
    stats.coach_reports_missing.length > 0
      ? `<p><b>Missing coach reports:</b> ${escapeHtml(stats.coach_reports_missing.map((c) => c.coach_name).join(', '))}</p>`
      : ''
  }`;

  const coachTable = `<h2>Coaches</h2><table><tr><th>Coach</th><th>Calls</th><th>Rating</th><th>Note</th></tr>${stats.per_coach
    .map((c) => {
      const note = content.coach_highlights?.find((h) => h.coach_id === c.coach_id)?.note;
      return `<tr><td>${escapeHtml(c.coach_name)}</td><td>${c.calls}</td><td>${c.rubric_average ?? 'n/a'}</td><td>${escapeHtml(note ?? (c.calls === 0 ? 'No calls this week' : ''))}</td></tr>`;
    })
    .join('')}</table>`;

  if (status === 'empty') {
    return page(title, periodLabel, `${statsHtml}<p>No coach reports with calls this week.</p>${coachTable}`);
  }

  return page(
    title,
    periodLabel,
    `${statsHtml}<h2>Trends</h2>${list(content.trends ?? [])}<h2>Client sentiment</h2><p>${escapeHtml(content.sentiment_notes ?? '')}</p><h2>At-risk clients</h2>${list(
      (content.at_risk_clients ?? []).map((c) => `${clientName(c.client_id)}: ${c.reason}`),
    )}<h2>Client concerns</h2>${list(
      (content.client_concerns ?? []).map((c) => `${c.concern} (${c.client_ids.map(clientName).join(', ')})`),
    )}<h2>Content ideas</h2>${list(
      (content.content_ideas ?? []).map((c) => `${c.title}: ${c.angle} (from ${c.client_ids.map(clientName).join(', ')})`),
    )}${coachTable}`,
  );
};
