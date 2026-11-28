/**
 * check-out — pure rules (BE-2 · Phase 4 · FR-SHIFT-04). Thresholds come from system_configs (passed in).
 */
import { ExecutionStatus } from '@healthcare-system/shared';
import type { CheckOutProblem } from './check-out.types';

const MINUTE_MS = 60_000;

/**
 * When check-out opens. A task-based service is paid 100% once its checklist is done, even early
 * (FR-SHIFT-04 rule 3): no time limit. Shift / hour-based services: from the scheduled end − tolerance.
 * Stopping a running shift earlier is the customer's "stop after check-in" (cancellation-policy row 4).
 */
export function checkOutOpensAt(serviceType: string, endMs: number, toleranceMinutes: number): number | null {
  return serviceType === 'TASK_BASED' ? null : endMs - toleranceMinutes * MINUTE_MS;
}

export function checkOutProblem(
  b: { nurseId: string | null; executionStatus: string; serviceType: string; endMs: number },
  nurseId: string,
  nowMs: number,
  toleranceMinutes: number,
): CheckOutProblem | null {
  if (b.nurseId !== nurseId) return 'NOT_ASSIGNED_NURSE';
  if (b.executionStatus === ExecutionStatus.COMPLETED) return 'ALREADY_CHECKED_OUT';
  if (b.executionStatus === ExecutionStatus.CONFIRMED) return 'NOT_CHECKED_IN';
  if (b.executionStatus !== ExecutionStatus.IN_PROGRESS) return 'SHIFT_NOT_IN_PROGRESS';
  const opensAt = checkOutOpensAt(b.serviceType, b.endMs, toleranceMinutes);
  if (opensAt !== null && nowMs < opensAt) return 'SHIFT_NOT_FINISHED';
  return null;
}
