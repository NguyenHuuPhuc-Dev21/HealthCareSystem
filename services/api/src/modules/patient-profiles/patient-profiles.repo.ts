/**
 * SQL for patient-profiles (ADR-0002). BE-2 · Phase 1 · FR-AUTH-03.
 * Write methods expect a transaction client; with no client they run on the pool.
 */
import type { KycStatus } from '@healthcare-system/shared';
import { query, type Queryable, type QueryResultRow } from '../../core/database';
import type {
  CustomerIdentityRow,
  CustomerKycDocuments,
  EkycQueueItem,
  PatientProfileRow,
  ProfileFields,
} from './patient-profiles.types';
import type { ConsentColumns } from '../privacy-consent/privacy-consent.types';

/** Profile columns, optionally qualified with a table alias (needed when joining users). */
const profileColumns = (a = '') => {
  const c = (name: string) => `${a ? `${a}.` : ''}${name}`;
  return `
  ${c('id')} AS id, ${c('customer_id')} AS customer_id, ${c('full_name')} AS full_name,
  to_char(${c('dob')}, 'YYYY-MM-DD') AS dob, ${c('gender')} AS gender, ${c('weight_kg')} AS weight_kg,
  ${c('mobility_status')} AS mobility_status, ${c('medical_history')} AS medical_history,
  ${c('is_infectious')} AS is_infectious, ${c('address_text')} AS address_text,
  ${c('location_type')} AS location_type, ${c('lat')} AS lat, ${c('lng')} AS lng,
  ${c('data_consent_accepted')} AS data_consent_accepted, ${c('consent_timestamp')} AS consent_timestamp,
  ${c('consent_withdrawn_at')} AS consent_withdrawn_at, ${c('created_at')} AS created_at`;
};
const PROFILE_COLUMNS = profileColumns();

const IDENTITY_COLUMNS = 'id, role, full_name, phone, kyc_status, cccd_number, kyc_documents';

/** camelCase field → column, for the PATCH whitelist. Nothing outside this map can be updated. */
const UPDATABLE: Record<keyof ProfileFields, { column: string; cast?: string }> = {
  fullName: { column: 'full_name' },
  dob: { column: 'dob', cast: 'date' },
  gender: { column: 'gender', cast: 'gender_enum' },
  weightKg: { column: 'weight_kg', cast: 'numeric' },
  mobilityStatus: { column: 'mobility_status', cast: 'mobility_status_enum' },
  medicalHistory: { column: 'medical_history' },
  isInfectious: { column: 'is_infectious' },
  addressText: { column: 'address_text' },
  locationType: { column: 'location_type', cast: 'location_type_enum' },
  lat: { column: 'lat', cast: 'numeric' },
  lng: { column: 'lng', cast: 'numeric' },
};

export class PgPatientProfilesRepo {
  constructor(private readonly db: Pick<Queryable, 'query'> | null = null) {}

  private run<R extends QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.db ? this.db.query<R>(sql, params) : query<R>(sql, params);
  }

  // ---- customer identity / eKYC ----

  async getCustomer(customerId: string): Promise<CustomerIdentityRow | null> {
    const { rows } = await this.run<CustomerIdentityRow>(`SELECT ${IDENTITY_COLUMNS} FROM users WHERE id = $1`, [customerId]);
    return rows[0] ?? null;
  }

  async lockCustomer(customerId: string): Promise<CustomerIdentityRow | null> {
    const { rows } = await this.run<CustomerIdentityRow>(
      `SELECT ${IDENTITY_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
      [customerId],
    );
    return rows[0] ?? null;
  }

  async saveEkycSubmission(customerId: string, cccdNumber: string, docs: CustomerKycDocuments): Promise<void> {
    await this.run(
      `UPDATE users
          SET cccd_number = $2, kyc_documents = $3::jsonb, kyc_status = 'PENDING'
        WHERE id = $1`,
      [customerId, cccdNumber, JSON.stringify(docs)],
    );
  }

  async saveEkycDecision(customerId: string, status: KycStatus, docs: CustomerKycDocuments): Promise<void> {
    await this.run(
      `UPDATE users SET kyc_status = $2::kyc_status_enum, kyc_documents = $3::jsonb WHERE id = $1`,
      [customerId, status, JSON.stringify(docs)],
    );
  }

  async listEkycQueue(limit: number, offset: number): Promise<EkycQueueItem[]> {
    const { rows } = await this.run<EkycQueueItem>(
      `SELECT id AS "customerId", full_name AS "fullName", phone,
              kyc_documents->>'submittedAt' AS "submittedAt"
         FROM users
        WHERE role = 'PATIENT' AND kyc_status = 'PENDING'
        ORDER BY kyc_documents->>'submittedAt' NULLS LAST, id
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  // ---- patient profiles ----

  async insertProfile(customerId: string, f: ProfileFields, consent: ConsentColumns): Promise<PatientProfileRow> {
    const { rows } = await this.run<PatientProfileRow>(
      `INSERT INTO patient_profiles
         (customer_id, full_name, dob, gender, weight_kg, mobility_status, medical_history, is_infectious,
          address_text, location_type, lat, lng,
          data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, $2, $3::date, $4::gender_enum, $5, $6::mobility_status_enum, $7, $8,
               $9, $10::location_type_enum, $11, $12,
               $13, $14, $15, $16)
       RETURNING ${PROFILE_COLUMNS}`,
      [
        customerId,
        f.fullName,
        f.dob,
        f.gender,
        f.weightKg,
        f.mobilityStatus,
        f.medicalHistory,
        f.isInfectious,
        f.addressText,
        f.locationType,
        f.lat,
        f.lng,
        consent.data_consent_accepted,
        consent.consent_timestamp,
        consent.consent_ip,
        consent.consent_device_id,
      ],
    );
    return rows[0];
  }

  async listProfiles(customerId: string): Promise<PatientProfileRow[]> {
    const { rows } = await this.run<PatientProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM patient_profiles
        WHERE customer_id = $1 AND deleted_at IS NULL
        ORDER BY created_at, id`,
      [customerId],
    );
    return rows;
  }

  /** Owned and not deleted, or null (the caller answers 403 — no existence leak, contract §6-5). */
  async findOwnedProfile(customerId: string, profileId: string): Promise<PatientProfileRow | null> {
    const { rows } = await this.run<PatientProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM patient_profiles
        WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`,
      [profileId, customerId],
    );
    return rows[0] ?? null;
  }

  async lockOwnedProfile(customerId: string, profileId: string): Promise<PatientProfileRow | null> {
    const { rows } = await this.run<PatientProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM patient_profiles
        WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [profileId, customerId],
    );
    return rows[0] ?? null;
  }

  /** Updates only whitelisted columns that are present in `patch`. */
  async updateProfile(profileId: string, patch: Partial<ProfileFields>): Promise<PatientProfileRow> {
    const sets: string[] = [];
    const params: unknown[] = [profileId];
    for (const [field, value] of Object.entries(patch) as [keyof ProfileFields, unknown][]) {
      const spec = UPDATABLE[field];
      if (!spec || value === undefined) continue;
      params.push(value);
      sets.push(`${spec.column} = $${params.length}${spec.cast ? `::${spec.cast}` : ''}`);
    }
    if (sets.length === 0) {
      const { rows } = await this.run<PatientProfileRow>(`SELECT ${PROFILE_COLUMNS} FROM patient_profiles WHERE id = $1`, [profileId]);
      return rows[0];
    }
    const { rows } = await this.run<PatientProfileRow>(
      `UPDATE patient_profiles SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PROFILE_COLUMNS}`,
      params,
    );
    return rows[0];
  }

  /** For the booking guard: the profile regardless of owner, plus the owner's eKYC status. */
  async findProfileForBooking(
    profileId: string,
  ): Promise<(PatientProfileRow & { deleted_at: Date | null; owner_kyc_status: KycStatus }) | null> {
    const { rows } = await this.run<PatientProfileRow & { deleted_at: Date | null; owner_kyc_status: KycStatus }>(
      `SELECT ${profileColumns('p')}, p.deleted_at, u.kyc_status AS owner_kyc_status
         FROM patient_profiles p
         JOIN users u ON u.id = p.customer_id
        WHERE p.id = $1`,
      [profileId],
    );
    return rows[0] ?? null;
  }
}
