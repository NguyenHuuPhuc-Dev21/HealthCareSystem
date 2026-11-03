# core/audit (BE-3)

Append-only writer for `audit_logs` (SRS §7 table 16, SEC-9.1).

```ts
import { writeAuditLog } from '../core/audit';
import { AuditAction } from '@healthcare-system/shared';

await writeAuditLog(tx, {
  actorId: adminId,                // null for automated system actions
  action: AuditAction.APPROVE_GPHN,
  targetTable: 'nurse_credentials',
  targetId: credentialId,
  oldValue: { verification_status: 'PENDING' },
  newValue: { verification_status: 'APPROVED' },
  ipAddress: req.ip,
});
```

- Pass the **transaction client** you used for the business change, so both commit or roll back together.
- Allowed actions are exactly `audit_action_enum`: `VIEW_MEDICAL_RECORD`, `APPROVE_GPHN`, `RESOLVE_DISPUTE`, `UPDATE_CONFIG`, `DELETE_PATIENT_DATA`, `GRANT_RECORD_ACCESS`. A new action needs a migration and an update to `packages/shared` (team consensus).
- There is no update/delete API, and the DB triggers `trg_audit_logs_no_update` / `trg_audit_logs_no_delete` reject mutations from any caller.
- Values are written to the database only, never to application logs (SEC-3.6).

Tests: `test/unit/core-audit.test.ts`, `test/integration/core-audit.test.ts`.
