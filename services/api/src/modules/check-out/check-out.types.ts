/**
 * check-out — types (BE-2 · Phase 4 · FR-SHIFT-04).
 */
import type { VitalsInput } from '../shift-logs/shift-logs.types';

export type CheckOutProblem =
  | 'NOT_ASSIGNED_NURSE'
  | 'NOT_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  | 'SHIFT_NOT_IN_PROGRESS'
  | 'SHIFT_NOT_FINISHED';

/** The minimal care report (FR-SHIFT-04): final vitals, the checklist, the handover note. */
export interface CheckOutInput {
  finalVitals: VitalsInput;
  completedActivityIds: string[];
  handoverNote: string;
}
