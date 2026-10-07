/**
 * Coach types (mirror backend/src/db/directoryRepo.ts)
 */

import type { CallListItem } from '../../calls';
import type { ClientListItem } from '../../clients';
import type { CoachReportSummary, CoachReportTrendPoint } from '../../reports';

export interface CoachListItem {
  id: string;
  name: string;
  email: string;
  client_count: number;
  call_count: number;
  calls_last_7_days: number;
}

export interface CoachDetail {
  coach: CoachListItem;
  clients: ClientListItem[];
  calls: CallListItem[];
  latestReport: CoachReportSummary | null;
  /** Recent weekly reports, oldest first */
  reportTrend: CoachReportTrendPoint[];
}
