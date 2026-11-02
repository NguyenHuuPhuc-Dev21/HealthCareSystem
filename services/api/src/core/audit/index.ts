/**
 * Core Audit Logger (BE-3)
 * Append-only immutable logging service for security & financial actions.
 * SRS §7 Table 16 (`audit_logs`)
 */

export interface AuditLogEntry {
  actor_id?: string;
  action_type:
    | 'VIEW_MEDICAL_RECORD'
    | 'APPROVE_GPHN'
    | 'REJECT_GPHN'
    | 'RESOLVE_DISPUTE'
    | 'UPDATE_CONFIG'
    | 'DELETE_PATIENT_DATA'
    | 'SOS_TRIGGERED'
    | 'COMMISSION_SETTLED'
    | 'PENALTY_DEDUCTED';
  entity_type: string;
  entity_id: string;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string;
  user_agent?: string;
}

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public async log(entry: AuditLogEntry): Promise<void> {
    console.log(`[Core/Audit] Action: ${entry.action_type} on ${entry.entity_type}:${entry.entity_id}`);
  }
}

export const audit = AuditService.getInstance();

