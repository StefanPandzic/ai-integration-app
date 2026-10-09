/** RTK Query tags the backend can invalidate (backend `LiveTag`) */
export const LIVE_TAGS = [
  'Call',
  'Client',
  'Coach',
  'Demo',
  'Report',
  'ReportRun',
  'Outbox',
  'Job',
  'Pipeline',
] as const;

export type LiveTag = (typeof LIVE_TAGS)[number];

/** `event: invalidate` payload from GET /api/events */
export interface InvalidateEvent {
  tags: LiveTag[];
}
