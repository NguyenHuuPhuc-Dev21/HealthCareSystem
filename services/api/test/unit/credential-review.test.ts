import { describe, expect, it } from 'vitest';
import { AuditAction, DocType, KycStatus, NurseTier, ProfileStatus } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import { computeTier, decideReviewOutcome } from '../../src/modules/credential-review/credential-review.policy';
import { PgReviewRepo } from '../../src/modules/credential-review/credential-review.repo';
import { verifySchema } from '../../src/modules/credential-review/credential-review.schema';
import { CredentialReviewService } from '../../src/modules/credential-review/credential-review.service';
import type {
  LockedProfile,
  PendingCredential,
  ReviewDecision,
  ReviewOutcome,
  ReviewRepo,
} from '../../src/modules/credential-review/credential-review.types';

const TODAY = '2026-11-03';
const NOW = Date.parse('2026-11-03T05:00:00Z');
const NURSE = '33333333-3333-4333-8333-333333333333';
const ADMIN = '60000000-0000-0000-0000-000000000001';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const C_FRONT: PendingCredential = { id: id(1), docType: DocType.CCCD, side: 'FRONT', documentNumber: '079', expiryDate: null, scopeOfPractice: null };
const C_BACK: PendingCredential = { id: id(2), docType: DocType.CCCD, side: 'BACK', documentNumber: '079', expiryDate: null, scopeOfPractice: null };
const DEGREE: PendingCredential = { id: id(3), docType: DocType.DEGREE, side: null, documentNumber: null, expiryDate: null, scopeOfPractice: null };
const GPHN: PendingCredential = { id: id(4), docType: DocType.GPHN, side: null, documentNumber: 'G-1', expiryDate: '2031-01-15', scopeOfPractice: 'Điều dưỡng' };
const RETIRE: PendingCredential = { id: id(5), docType: DocType.RETIREMENT_DECISION, side: null, documentNumber: null, expiryDate: null, scopeOfPractice: null };

const pendingProfile = (): LockedProfile => ({
  profileStatus: ProfileStatus.PENDING_VERIFICATION,
  tier: NurseTier.TIER_1_BASIC,
  gphnNumber: null,
  gphnExpiryDate: null,
  scopeOfPractice: null,
  isRetiredMedicalStaff: false,
});

const approveAll = (...cs: PendingCredential[]): ReviewDecision[] => cs.map((c) => ({ credentialId: c.id, decision: 'APPROVED' }));
const reject = (c: PendingCredential): ReviewDecision => ({ credentialId: c.id, decision: 'REJECTED', rejectionReason: 'Ảnh mờ, không đọc được' });

function expectAppError(fn: () => unknown, status: number, code: string) {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  expect((err as AppError).status).toBe(status);
}

describe('computeTier', () => {
  it('Tier 2 only with an approved GPHN that is still valid', () => {
    expect(computeTier('G-1', '2031-01-15', TODAY)).toBe(NurseTier.TIER_2_SPECIALIST);
    expect(computeTier('G-1', TODAY, TODAY)).toBe(NurseTier.TIER_1_BASIC); // expires today
    expect(computeTier('G-1', '2020-01-01', TODAY)).toBe(NurseTier.TIER_1_BASIC);
    expect(computeTier(null, null, TODAY)).toBe(NurseTier.TIER_1_BASIC);
  });
});

describe('first review (PENDING_VERIFICATION)', () => {
  it('CCCD + degree + valid GPHN approved → ACTIVE, TIER_2, KYC verified (US-HP-04 AC-02)', () => {
    const o = decideReviewOutcome({
      profile: pendingProfile(),
      pending: [C_FRONT, C_BACK, DEGREE, GPHN],
      decisions: approveAll(C_FRONT, C_BACK, DEGREE, GPHN),
      today: TODAY,
    });
    expect(o).toMatchObject({ profileStatus: ProfileStatus.ACTIVE, tier: NurseTier.TIER_2_SPECIALIST, kycStatus: KycStatus.VERIFIED, activated: true });
    expect(o.approvedGphn).toEqual({ number: 'G-1', expiryDate: '2031-01-15', scopeOfPractice: 'Điều dưỡng' });
  });

  it('degree without GPHN → ACTIVE, TIER_1', () => {
    const o = decideReviewOutcome({ profile: pendingProfile(), pending: [C_FRONT, C_BACK, DEGREE], decisions: approveAll(C_FRONT, C_BACK, DEGREE), today: TODAY });
    expect(o.tier).toBe(NurseTier.TIER_1_BASIC);
    expect(o.profileStatus).toBe(ProfileStatus.ACTIVE);
  });

  it('retirement decision without GPHN → TIER_1 + badge, never TIER_2 (TC-AUTH-01, AC-03)', () => {
    const o = decideReviewOutcome({
      profile: pendingProfile(),
      pending: [C_FRONT, C_BACK, DEGREE, RETIRE],
      decisions: approveAll(C_FRONT, C_BACK, DEGREE, RETIRE),
      today: TODAY,
    });
    expect(o.tier).toBe(NurseTier.TIER_1_BASIC);
    expect(o.isRetiredMedicalStaff).toBe(true);
  });

  it('GPHN rejected but the rest approved → ACTIVE at TIER_1', () => {
    const o = decideReviewOutcome({
      profile: pendingProfile(),
      pending: [C_FRONT, C_BACK, DEGREE, GPHN],
      decisions: [...approveAll(C_FRONT, C_BACK, DEGREE), reject(GPHN)],
      today: TODAY,
    });
    expect(o).toMatchObject({ profileStatus: ProfileStatus.ACTIVE, tier: NurseTier.TIER_1_BASIC });
    expect(o.approvedGphn).toBeUndefined();
  });

  it('a rejected CCCD side keeps the profile pending and KYC unverified', () => {
    const o = decideReviewOutcome({
      profile: pendingProfile(),
      pending: [C_FRONT, C_BACK, DEGREE, GPHN],
      decisions: [...approveAll(C_FRONT, DEGREE, GPHN), reject(C_BACK)],
      today: TODAY,
    });
    expect(o).toMatchObject({ profileStatus: ProfileStatus.PENDING_VERIFICATION, kycStatus: KycStatus.UNVERIFIED, activated: false });
    expect(o.approvedGphn).toBeUndefined(); // nothing copied while not active
  });

  it('a rejected degree keeps the profile pending (identity can still be verified)', () => {
    const o = decideReviewOutcome({
      profile: pendingProfile(),
      pending: [C_FRONT, C_BACK, DEGREE],
      decisions: [...approveAll(C_FRONT, C_BACK), reject(DEGREE)],
      today: TODAY,
    });
    expect(o).toMatchObject({ profileStatus: ProfileStatus.PENDING_VERIFICATION, kycStatus: KycStatus.VERIFIED });
  });

  it('every pending document must be decided — no partial review', () => {
    expectAppError(
      () => decideReviewOutcome({ profile: pendingProfile(), pending: [C_FRONT, C_BACK, DEGREE], decisions: approveAll(C_FRONT, C_BACK), today: TODAY }),
      400,
      'INCOMPLETE_REVIEW',
    );
  });

  it('a decision for a document that is not pending is refused', () => {
    expectAppError(
      () => decideReviewOutcome({ profile: pendingProfile(), pending: [C_FRONT, C_BACK, DEGREE], decisions: approveAll(C_FRONT, C_BACK, DEGREE, GPHN), today: TODAY }),
      400,
      'UNKNOWN_CREDENTIAL',
    );
  });

  it('an expired GPHN cannot be approved', () => {
    const old = { ...GPHN, expiryDate: '2026-11-01' };
    expectAppError(
      () => decideReviewOutcome({ profile: pendingProfile(), pending: [C_FRONT, C_BACK, DEGREE, old], decisions: approveAll(C_FRONT, C_BACK, DEGREE, old), today: TODAY }),
      400,
      'GPHN_EXPIRED',
    );
  });

  it('nothing pending → 409; banned → 409', () => {
    expectAppError(() => decideReviewOutcome({ profile: pendingProfile(), pending: [], decisions: [], today: TODAY }), 409, 'NOTHING_TO_REVIEW');
    expectAppError(
      () => decideReviewOutcome({ profile: { ...pendingProfile(), profileStatus: ProfileStatus.BANNED }, pending: [DEGREE], decisions: approveAll(DEGREE), today: TODAY }),
      409,
      'PROFILE_BANNED',
    );
  });
});

describe('renewal review (ACTIVE nurse)', () => {
  const demoted: LockedProfile = {
    profileStatus: ProfileStatus.ACTIVE,
    tier: NurseTier.TIER_1_BASIC, // demoted by the daily sweep after the old GPHN expired
    gphnNumber: 'OLD',
    gphnExpiryDate: '2026-10-01',
    scopeOfPractice: 'old scope',
    isRetiredMedicalStaff: false,
  };

  it('approving the renewed GPHN re-upgrades to TIER_2 (TC-AUTH-03, AC-05)', () => {
    const o = decideReviewOutcome({ profile: demoted, pending: [GPHN], decisions: approveAll(GPHN), today: TODAY });
    expect(o).toMatchObject({ profileStatus: ProfileStatus.ACTIVE, tier: NurseTier.TIER_2_SPECIALIST, activated: false });
    expect(o.kycStatus).toBeUndefined();
    expect(o.approvedGphn?.number).toBe('G-1');
  });

  it('rejecting it keeps TIER_1 and the old data', () => {
    const o = decideReviewOutcome({ profile: demoted, pending: [GPHN], decisions: [reject(GPHN)], today: TODAY });
    expect(o.tier).toBe(NurseTier.TIER_1_BASIC);
    expect(o.approvedGphn).toBeUndefined();
  });

  it('a suspended nurse stays SUSPENDED (tier still recomputed)', () => {
    const o = decideReviewOutcome({ profile: { ...demoted, profileStatus: ProfileStatus.SUSPENDED }, pending: [GPHN], decisions: approveAll(GPHN), today: TODAY });
    expect(o.profileStatus).toBe(ProfileStatus.SUSPENDED);
    expect(o.tier).toBe(NurseTier.TIER_2_SPECIALIST);
  });
});

describe('schema', () => {
  it('requires a reason when rejecting', () => {
    expect(verifySchema.safeParse({ decisions: [{ credentialId: id(1), decision: 'REJECTED' }] }).success).toBe(false);
    expect(verifySchema.safeParse({ decisions: [{ credentialId: id(1), decision: 'REJECTED', rejectionReason: 'Ảnh mờ quá' }] }).success).toBe(true);
    // the Admin cannot pick a tier by hand — it is derived from approved documents
    expect(verifySchema.safeParse({ decisions: [{ credentialId: id(1), decision: 'APPROVED' }], tier: 'TIER_2_SPECIALIST' }).success).toBe(false);
  });
});

// ---- service (transaction + audit) with a fake repo ------------------------

class FakeRepo implements ReviewRepo {
  profile: LockedProfile | null = pendingProfile();
  pending: PendingCredential[] = [C_FRONT, C_BACK, DEGREE, GPHN];
  saved: { reviewer: string; decisions: ReviewDecision[] } | null = null;
  updated: ReviewOutcome | null = null;
  kyc: KycStatus | null = null;
  audits: unknown[] = [];
  gphnInserted = 0;
  async lockProfile() {
    return this.profile;
  }
  async lockPendingCredentials() {
    return this.pending;
  }
  async saveDecisions(_n: string, reviewer: string, decisions: ReviewDecision[]) {
    this.saved = { reviewer, decisions };
  }
  async updateProfile(_n: string, o: ReviewOutcome) {
    this.updated = o;
  }
  async setKycStatus(_n: string, k: KycStatus) {
    this.kyc = k;
  }
  async insertAudit(e: unknown) {
    this.audits.push(e);
  }
  async insertGphn() {
    this.gphnInserted++;
  }
}

function service(repo: FakeRepo, fileOk = true) {
  return new CredentialReviewService({
    read: { listQueue: async () => [], getDossier: async () => null },
    withTx: (fn) => fn(repo),
    downloadUrl: async (k) => `https://signed/${k}`,
    verifyGphnFile: async () => {
      if (!fileOk) throw new AppError(400, 'FILE_NOT_UPLOADED', 'x');
    },
    now: () => NOW,
  });
}

describe('CredentialReviewService.verify', () => {
  it('records reviewed_by, updates the profile + KYC and writes an APPROVE_GPHN audit entry', async () => {
    const repo = new FakeRepo();
    const res = await service(repo).verify(ADMIN, NURSE, { decisions: approveAll(C_FRONT, C_BACK, DEGREE, GPHN) }, '1.2.3.4');
    expect(res).toMatchObject({ profileStatus: ProfileStatus.ACTIVE, tier: NurseTier.TIER_2_SPECIALIST, activated: true });
    expect(repo.saved!.reviewer).toBe(ADMIN);
    expect(repo.kyc).toBe(KycStatus.VERIFIED);
    expect(repo.audits).toHaveLength(1);
    expect(repo.audits[0]).toMatchObject({ actorId: ADMIN, action: 'APPROVE_GPHN', targetId: NURSE, ip: '1.2.3.4' });
  });

  it('no audit entry when no GPHN was approved', async () => {
    const repo = new FakeRepo();
    await service(repo).verify(ADMIN, NURSE, { decisions: [...approveAll(C_FRONT, C_BACK, DEGREE), reject(GPHN)] }, null);
    expect(repo.audits).toHaveLength(0);
  });

  it('unknown nurse → 404, nothing written', async () => {
    const repo = new FakeRepo();
    repo.profile = null;
    await expect(service(repo).verify(ADMIN, NURSE, { decisions: approveAll(DEGREE) }, null)).rejects.toThrow(/not found/);
    expect(repo.saved).toBe(null);
  });
});

describe('CredentialReviewService.submitGphnRenewal', () => {
  const body = { fileKey: 'nurse-gphn/x/y.jpg', number: 'G-2', issuedDate: '2026-10-01', expiryDate: '2031-10-01', issuingAuthority: 'Sở Y tế', scopeOfPractice: 'Điều dưỡng' };
  const active = (): LockedProfile => ({ ...pendingProfile(), profileStatus: ProfileStatus.ACTIVE });

  it('an ACTIVE nurse can send a renewed GPHN; it waits for review', async () => {
    const repo = new FakeRepo();
    repo.profile = active();
    repo.pending = [];
    await service(repo).submitGphnRenewal(NURSE, body);
    expect(repo.gphnInserted).toBe(1);
  });

  it('refused while another GPHN is pending, while onboarding is pending, or when banned', async () => {
    const repo = new FakeRepo();
    repo.profile = active();
    repo.pending = [GPHN];
    await expect(service(repo).submitGphnRenewal(NURSE, body)).rejects.toThrow(/already waiting/);
    repo.profile = pendingProfile();
    repo.pending = [];
    await expect(service(repo).submitGphnRenewal(NURSE, body)).rejects.toThrow(/under review/);
    repo.profile = { ...active(), profileStatus: ProfileStatus.BANNED };
    await expect(service(repo).submitGphnRenewal(NURSE, body)).rejects.toThrow(/permanently locked/);
    expect(repo.gphnInserted).toBe(0);
  });

  it('rejects an expired renewal and a bad file before touching the DB', async () => {
    const repo = new FakeRepo();
    repo.profile = active();
    repo.pending = [];
    await expect(service(repo).submitGphnRenewal(NURSE, { ...body, expiryDate: '2026-11-02' })).rejects.toThrow(/expired/);
    await expect(service(repo, false).submitGphnRenewal(NURSE, body)).rejects.toThrow();
    expect(repo.gphnInserted).toBe(0);
  });
});

describe('PgReviewRepo.insertAudit → core/audit writeAuditLog', () => {
  it('writes through the transaction client with the agreed fields', async () => {
    const calls: { text: string; params?: unknown[] }[] = [];
    const tx = {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return { rows: [{ id: 'a1', created_at: '2026-11-03T00:00:00Z' }], rowCount: 1 } as never;
      },
    };
    await new PgReviewRepo(tx).insertAudit({
      actorId: ADMIN,
      action: AuditAction.APPROVE_GPHN,
      targetId: NURSE,
      oldValue: { tier: 'TIER_1_BASIC' },
      newValue: { tier: 'TIER_2_SPECIALIST' },
      ip: '1.2.3.4',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain('INSERT INTO audit_logs');
    expect(calls[0]!.params).toEqual([
      ADMIN,
      'APPROVE_GPHN',
      'nurse_profiles',
      NURSE,
      JSON.stringify({ tier: 'TIER_1_BASIC' }),
      JSON.stringify({ tier: 'TIER_2_SPECIALIST' }),
      '1.2.3.4',
    ]);
  });

  it('rejects an invalid actor id before touching the DB (core/audit validation)', async () => {
    let called = false;
    const tx = { query: async () => ((called = true), { rows: [], rowCount: 0 }) as never };
    await expect(
      new PgReviewRepo(tx).insertAudit({ actorId: 'not-a-uuid', action: AuditAction.APPROVE_GPHN, targetId: NURSE, oldValue: null, newValue: null, ip: null }),
    ).rejects.toThrow(/actorId/);
    expect(called).toBe(false);
  });
});
