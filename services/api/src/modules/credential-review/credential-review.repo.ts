/** SQL for credential-review (ADR-0002). Write methods expect a transaction client. */
import type { KycStatus } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { query, type Queryable, type QueryResultRow } from '../../core/database';
import type {
  DossierRecord,
  LockedProfile,
  PendingCredential,
  QueueItem,
  ReviewDecision,
  ReviewOutcome,
  ReviewReadRepo,
  ReviewRepo,
} from './credential-review.types';

const DATE = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;
const TS = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

class Base {
  constructor(protected readonly db: Pick<Queryable, 'query'> | null = null) {}
  protected run<R extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<{ rows: R[]; rowCount: number | null }> {
    return this.db ? this.db.query<R>(sql, params) : query<R>(sql, params);
  }
}

const PROFILE_COLUMNS = `
  profile_status AS "profileStatus", tier,
  gphn_number AS "gphnNumber", ${DATE('gphn_expiry_date')} AS "gphnExpiryDate",
  scope_of_practice AS "scopeOfPractice", is_retired_medical_staff AS "isRetiredMedicalStaff"`;

export class PgReviewRepo extends Base implements ReviewRepo {
  async lockProfile(nurseId: string): Promise<LockedProfile | null> {
    const { rows } = await this.run<LockedProfile>(
      `SELECT ${PROFILE_COLUMNS} FROM nurse_profiles WHERE user_id = $1 FOR UPDATE`,
      [nurseId],
    );
    return rows[0] ?? null;
  }

  async lockPendingCredentials(nurseId: string): Promise<PendingCredential[]> {
    const { rows } = await this.run<PendingCredential>(
      `SELECT id, doc_type AS "docType", document_side AS side, document_number AS "documentNumber",
              ${DATE('expiry_date')} AS "expiryDate", scope_of_practice AS "scopeOfPractice"
         FROM nurse_credentials
        WHERE nurse_id = $1 AND verification_status = 'PENDING'
        ORDER BY created_at
        FOR UPDATE`,
      [nurseId],
    );
    return rows;
  }

  async saveDecisions(nurseId: string, reviewerId: string, decisions: ReviewDecision[]) {
    for (const d of decisions) {
      await this.run(
        `UPDATE nurse_credentials
            SET verification_status = $3::verification_status_enum, reviewed_by = $4, reviewed_at = now(),
                rejection_reason = $5
          WHERE id = $1 AND nurse_id = $2 AND verification_status = 'PENDING'`,
        [d.credentialId, nurseId, d.decision, reviewerId, d.decision === 'REJECTED' ? (d.rejectionReason ?? null) : null],
      );
    }
  }

  async updateProfile(nurseId: string, o: ReviewOutcome) {
    await this.run(
      `UPDATE nurse_profiles
          SET profile_status = $2::profile_status_enum,
              tier = $3::nurse_tier_enum,
              gphn_number = COALESCE($4, gphn_number),
              gphn_expiry_date = COALESCE($5::date, gphn_expiry_date),
              scope_of_practice = CASE WHEN $4::text IS NULL THEN scope_of_practice ELSE $6 END,
              is_retired_medical_staff = $7,
              updated_at = now()
        WHERE user_id = $1`,
      [
        nurseId,
        o.profileStatus,
        o.tier,
        o.approvedGphn?.number ?? null,
        o.approvedGphn?.expiryDate ?? null,
        o.approvedGphn?.scopeOfPractice ?? null,
        o.isRetiredMedicalStaff,
      ],
    );
  }

  async setKycStatus(nurseId: string, kycStatus: KycStatus) {
    await this.run('UPDATE users SET kyc_status = $2::kyc_status_enum WHERE id = $1', [nurseId, kycStatus]);
  }

  async insertAudit(e: Parameters<ReviewRepo['insertAudit']>[0]) {
    // Agreed internal interface (plan §4.1): BE-3's writeAuditLog, on THIS transaction's client,
    // so the audit row commits or rolls back together with the review decision.
    await writeAuditLog(this.db ?? { query: (text, params) => query(text, params) }, {
      actorId: e.actorId,
      action: e.action,
      targetTable: 'nurse_profiles',
      targetId: e.targetId,
      oldValue: e.oldValue,
      newValue: e.newValue,
      ...(e.ip ? { ipAddress: e.ip } : {}),
    });
  }

  async insertGphn(
    nurseId: string,
    g: { fileKey: string; number: string; issuedDate: string; expiryDate: string; issuingAuthority: string; scopeOfPractice: string },
  ) {
    await this.run(
      `INSERT INTO nurse_credentials
         (nurse_id, doc_type, file_url, document_number, issued_date, expiry_date, issuing_authority, scope_of_practice)
       VALUES ($1, 'GPHN', $2, $3, $4, $5, $6, $7)`,
      [nurseId, g.fileKey, g.number, g.issuedDate, g.expiryDate, g.issuingAuthority, g.scopeOfPractice],
    );
  }
}

export class PgReviewReadRepo extends Base implements ReviewReadRepo {
  async listQueue(limit: number, offset: number): Promise<QueueItem[]> {
    const { rows } = await this.run<QueueItem>(
      `SELECT u.id AS "nurseId", u.full_name AS "fullName", u.phone,
              np.profile_status AS "profileStatus", np.tier,
              count(*)::int AS "pendingCount",
              bool_or(nc.doc_type = 'GPHN') AS "hasPendingGphn",
              ${TS('min(nc.created_at)')} AS "oldestPendingAt",
              CASE WHEN np.profile_status = 'PENDING_VERIFICATION' THEN 'ONBOARDING' ELSE 'RENEWAL' END AS kind
         FROM nurse_credentials nc
         JOIN nurse_profiles np ON np.user_id = nc.nurse_id
         JOIN users u ON u.id = nc.nurse_id
        WHERE nc.verification_status = 'PENDING' AND np.profile_status <> 'BANNED'
        GROUP BY u.id, u.full_name, u.phone, np.profile_status, np.tier
        ORDER BY min(nc.created_at)
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async getDossier(nurseId: string): Promise<DossierRecord | null> {
    const head = await this.run<
      Omit<DossierRecord, 'profile' | 'credentials'> & LockedProfile & { yearsOfExp: number; trustScore: number }
    >(
      `SELECT u.id AS "nurseId", u.full_name AS "fullName", u.phone, u.gender, u.cccd_number AS "cccdNumber",
              u.kyc_status AS "kycStatus", u.kyc_documents AS "kycDocuments",
              np.profile_status AS "profileStatus", np.tier,
              np.gphn_number AS "gphnNumber", ${DATE('np.gphn_expiry_date')} AS "gphnExpiryDate",
              np.scope_of_practice AS "scopeOfPractice", np.is_retired_medical_staff AS "isRetiredMedicalStaff",
              np.years_of_exp AS "yearsOfExp", np.trust_score AS "trustScore"
         FROM users u JOIN nurse_profiles np ON np.user_id = u.id
        WHERE u.id = $1`,
      [nurseId],
    );
    const h = head.rows[0];
    if (!h) return null;
    const creds = await this.run<DossierRecord['credentials'][number]>(
      `SELECT id, doc_type AS "docType", document_side AS side, document_number AS "documentNumber",
              ${DATE('issued_date')} AS "issuedDate", ${DATE('expiry_date')} AS "expiryDate",
              issuing_authority AS "issuingAuthority", scope_of_practice AS "scopeOfPractice",
              verification_status AS "verificationStatus", rejection_reason AS "rejectionReason",
              reviewed_by AS "reviewedBy", ${TS('reviewed_at')} AS "reviewedAt",
              ${TS('created_at')} AS "submittedAt", file_url AS "fileKey"
         FROM nurse_credentials WHERE nurse_id = $1
        ORDER BY created_at DESC, doc_type, document_side DESC NULLS LAST`,
      [nurseId],
    );
    return {
      nurseId: h.nurseId,
      fullName: h.fullName,
      phone: h.phone,
      gender: h.gender,
      cccdNumber: h.cccdNumber,
      kycStatus: h.kycStatus,
      kycDocuments: h.kycDocuments,
      profile: {
        profileStatus: h.profileStatus,
        tier: h.tier,
        gphnNumber: h.gphnNumber,
        gphnExpiryDate: h.gphnExpiryDate,
        scopeOfPractice: h.scopeOfPractice,
        isRetiredMedicalStaff: h.isRetiredMedicalStaff,
        yearsOfExp: h.yearsOfExp,
        trustScore: h.trustScore,
      },
      credentials: creds.rows,
    };
  }
}
