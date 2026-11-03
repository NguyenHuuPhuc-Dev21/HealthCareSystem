/** Parameterised SQL for accounts-otp (ADR-0002). The only file of this module that touches the DB. */
import type { KycStatus, ProfileStatus, UserRole, UserStatus } from '@healthcare-system/shared';
import { query, type Queryable } from '../../core/database';
import type { AccountsRepo, AuthUserRecord, SelfRegisterRole } from './accounts-otp.types';

interface Row {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  kyc_status: KycStatus;
  profile_status: ProfileStatus | null;
}

const SELECT_USER = `
  SELECT u.id, u.phone, u.full_name, u.role, u.status, u.kyc_status, np.profile_status
  FROM users u
  LEFT JOIN nurse_profiles np ON np.user_id = u.id`;

function toRecord(r: Row): AuthUserRecord {
  return {
    id: r.id,
    phone: r.phone,
    fullName: r.full_name,
    role: r.role,
    status: r.status,
    kycStatus: r.kyc_status,
    nurseProfileStatus: r.profile_status,
  };
}

export class PgAccountsRepo implements AccountsRepo {
  /** `db` defaults to the shared pool; pass a transaction client when needed. */
  constructor(private readonly db: Pick<Queryable, 'query'> | null = null) {}

  private run(sql: string, params: unknown[]) {
    return this.db ? this.db.query<Row>(sql, params) : query<Row>(sql, params);
  }

  async findByPhone(phone: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.run(`${SELECT_USER} WHERE u.phone = $1`, [phone]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.run(`${SELECT_USER} WHERE u.id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  /**
   * New self-registered accounts start ACTIVE at the account level.
   * A nurse's right to take jobs is NOT decided here: it stays governed by
   * nurse_profiles.profile_status, created later by nurse-onboarding.
   */
  async createUser(input: { phone: string; fullName: string; role: SelfRegisterRole }): Promise<AuthUserRecord | null> {
    const { rows } = await this.run(
      `INSERT INTO users (phone, full_name, role, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (phone) DO NOTHING
       RETURNING id, phone, full_name, role, status, kyc_status, NULL::profile_status_enum AS profile_status`,
      [input.phone, input.fullName, input.role],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }
}
