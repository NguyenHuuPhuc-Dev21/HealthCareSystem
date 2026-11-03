/** SQL for nurse-onboarding (ADR-0002). Pass the transaction client for writes. */
import type { DocType, Gender, KycStatus, NurseTier, ProfileStatus, VerificationStatus } from '@healthcare-system/shared';
import { query, type Queryable, type QueryResultRow } from '../../core/database';
import { conflict } from '../../core/errors';
import type { CredentialView, KycDocuments, NewCredential, OnboardingRepo, OnboardingStatus } from './nurse-onboarding.types';

interface CredentialRow {
  id: string;
  doc_type: DocType;
  document_side: 'FRONT' | 'BACK' | null;
  document_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string;
}

export class PgOnboardingRepo implements OnboardingRepo {
  constructor(private readonly db: Pick<Queryable, 'query'> | null = null) {}

  private run<R extends QueryResultRow>(sql: string, params: unknown[]) {
    return this.db ? this.db.query<R>(sql, params) : query<R>(sql, params);
  }

  async lockOrCreateProfile(userId: string, yearsOfExp: number) {
    const inserted = await this.run<{ user_id: string }>(
      `INSERT INTO nurse_profiles (user_id, years_of_exp) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING RETURNING user_id`,
      [userId, yearsOfExp],
    );
    const { rows } = await this.run<{ profile_status: ProfileStatus }>(
      'SELECT profile_status FROM nurse_profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    return { profileStatus: rows[0]!.profile_status, created: inserted.rows.length === 1 };
  }

  async countPendingCredentials(userId: string) {
    const { rows } = await this.run<{ n: number }>(
      `SELECT count(*)::int AS n FROM nurse_credentials WHERE nurse_id = $1 AND verification_status = 'PENDING'`,
      [userId],
    );
    return rows[0]?.n ?? 0;
  }

  async updateNurseIdentity(userId: string, input: { cccdNumber: string; gender?: Gender; kycDocuments: KycDocuments }) {
    try {
      await this.run(
        `UPDATE users
           SET cccd_number = $2,
               gender = COALESCE($3::gender_enum, gender),
               kyc_documents = $4::jsonb,
               kyc_status = 'PENDING'
         WHERE id = $1 AND role = 'NURSE'`,
        [userId, input.cccdNumber, input.gender ?? null, JSON.stringify(input.kycDocuments)],
      );
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === '23505' && e.constraint === 'uq_users_cccd_number') {
        throw conflict('CCCD_ALREADY_REGISTERED', 'This CCCD number is already linked to another account');
      }
      throw err;
    }
  }

  async updateYearsOfExp(userId: string, yearsOfExp: number) {
    await this.run('UPDATE nurse_profiles SET years_of_exp = $2, updated_at = now() WHERE user_id = $1', [
      userId,
      yearsOfExp,
    ]);
  }

  async insertCredentials(userId: string, credentials: NewCredential[]) {
    for (const c of credentials) {
      await this.run(
        `INSERT INTO nurse_credentials
           (nurse_id, doc_type, file_url, document_side, document_number, issued_date, expiry_date,
            issuing_authority, scope_of_practice)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          c.docType,
          c.fileKey,
          c.side ?? null,
          c.documentNumber ?? null,
          c.issuedDate ?? null,
          c.expiryDate ?? null,
          c.issuingAuthority ?? null,
          c.scopeOfPractice ?? null,
        ],
      );
    }
  }

  async getStatus(userId: string): Promise<OnboardingStatus | null> {
    const head = await this.run<{ kyc_status: KycStatus; profile_status: ProfileStatus | null; tier: NurseTier | null }>(
      `SELECT u.kyc_status, np.profile_status, np.tier
         FROM users u LEFT JOIN nurse_profiles np ON np.user_id = u.id
        WHERE u.id = $1 AND u.role = 'NURSE'`,
      [userId],
    );
    const h = head.rows[0];
    if (!h) return null;
    // Dates as text: a JS Date for a DATE column would shift with the server timezone.
    const creds = await this.run<CredentialRow>(
      `SELECT id, doc_type, document_side, document_number,
              to_char(issued_date, 'YYYY-MM-DD') AS issued_date,
              to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date,
              verification_status, rejection_reason,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS submitted_at
         FROM nurse_credentials WHERE nurse_id = $1
        ORDER BY created_at, doc_type, document_side DESC NULLS LAST`, // CCCD FRONT before BACK
      [userId],
    );
    const credentials: CredentialView[] = creds.rows.map((r) => ({
      id: r.id,
      docType: r.doc_type,
      side: r.document_side,
      documentNumber: r.document_number,
      issuedDate: r.issued_date,
      expiryDate: r.expiry_date,
      verificationStatus: r.verification_status,
      rejectionReason: r.rejection_reason,
      submittedAt: r.submitted_at,
    }));
    // A tier exists only once an Admin has approved the profile (credential-review).
    const approved = h.profile_status === 'ACTIVE' || h.profile_status === 'SUSPENDED';
    return { profileStatus: h.profile_status, tier: approved ? h.tier : null, kycStatus: h.kyc_status, credentials };
  }
}
