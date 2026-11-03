import { describe, expect, it } from 'vitest';
import { DocType, KycStatus, ProfileStatus, VerificationStatus, type NurseTier } from '@healthcare-system/shared';
import { AppError, conflict } from '../../src/core/errors';
import { buildObjectKey, detectContentType, type ObjectInfo } from '../../src/core/storage';
import { submitOnboardingSchema } from '../../src/modules/nurse-onboarding/nurse-onboarding.schema';
import { NurseOnboardingService, todayInVietnam } from '../../src/modules/nurse-onboarding/nurse-onboarding.service';
import type {
  KycDocuments,
  NewCredential,
  OnboardingRepo,
  OnboardingStatus,
  StoragePort,
} from '../../src/modules/nurse-onboarding/nurse-onboarding.types';

const NURSE = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const NOW = Date.parse('2026-11-03T05:00:00Z'); // 12:00 in Vietnam

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n........', 'latin1');
const EXE = Buffer.from('MZ\x90\x00........', 'latin1');

class FakeStorage implements StoragePort {
  objects = new Map<string, { info: ObjectInfo; head: Buffer }>();
  buildObjectKey = buildObjectKey;
  async createUploadUrl(objectKey: string) {
    return { url: `https://minio.local/${objectKey}?sig`, objectKey, expiresInSeconds: 600 };
  }
  async statObject(key: string) {
    return this.objects.get(key)?.info ?? null;
  }
  async readObjectHead(key: string) {
    return this.objects.get(key)?.head ?? null;
  }
  /** Simulates the client's PUT to the presigned URL. */
  put(key: string, head: Buffer, size = 200_000) {
    this.objects.set(key, { info: { sizeBytes: size, contentType: undefined }, head });
    return key;
  }
}

class FakeRepo implements OnboardingRepo {
  profile: { status: ProfileStatus; years: number } | null = null;
  credentials: (NewCredential & { status: VerificationStatus })[] = [];
  identity: { cccdNumber: string; kycDocuments: KycDocuments } | null = null;
  takenCccd = new Set<string>();
  kyc = KycStatus.UNVERIFIED;

  async lockOrCreateProfile(_userId: string, yearsOfExp: number) {
    if (this.profile) return { profileStatus: this.profile.status, created: false };
    this.profile = { status: ProfileStatus.PENDING_VERIFICATION, years: yearsOfExp };
    return { profileStatus: this.profile.status, created: true };
  }
  async countPendingCredentials() {
    return this.credentials.filter((c) => c.status === VerificationStatus.PENDING).length;
  }
  async updateNurseIdentity(_u: string, input: { cccdNumber: string; kycDocuments: KycDocuments }) {
    if (this.takenCccd.has(input.cccdNumber)) throw conflict('CCCD_ALREADY_REGISTERED', 'taken');
    this.identity = input;
    this.kyc = KycStatus.PENDING;
  }
  async updateYearsOfExp(_u: string, y: number) {
    this.profile!.years = y;
  }
  async insertCredentials(_u: string, creds: NewCredential[]) {
    for (const c of creds) this.credentials.push({ ...c, status: VerificationStatus.PENDING });
  }
  async getStatus(): Promise<OnboardingStatus> {
    return {
      profileStatus: this.profile?.status ?? null,
      tier: this.profile ? ('TIER_1_BASIC' as NurseTier) : null,
      kycStatus: this.kyc,
      credentials: this.credentials.map((c, i) => ({
        id: String(i),
        docType: c.docType,
        side: c.side ?? null,
        documentNumber: c.documentNumber ?? null,
        issuedDate: c.issuedDate ?? null,
        expiryDate: c.expiryDate ?? null,
        verificationStatus: c.status,
        rejectionReason: null,
        submittedAt: '2026-11-03T05:00:00Z',
      })),
    };
  }
}

function setup() {
  const storage = new FakeStorage();
  const repo = new FakeRepo();
  // Transaction semantics: if fn throws, restore the repo snapshot (like ROLLBACK).
  const withTx = async <T>(fn: (r: OnboardingRepo) => Promise<T>): Promise<T> => {
    const snapshot = JSON.stringify({ p: repo.profile, c: repo.credentials, i: repo.identity, k: repo.kyc });
    try {
      return await fn(repo);
    } catch (e) {
      const s = JSON.parse(snapshot);
      repo.profile = s.p;
      repo.credentials = s.c;
      repo.identity = s.i;
      repo.kyc = s.k;
      throw e;
    }
  };
  const svc = new NurseOnboardingService({ storage, repo, withTx, maxUploadBytes: 10 * 1024 * 1024, now: () => NOW });
  return { svc, storage, repo };
}

function upload(storage: FakeStorage, category: Parameters<typeof buildObjectKey>[0], head = JPEG, owner = NURSE, type = 'image/jpeg') {
  return storage.put(buildObjectKey(category, owner, type), head);
}

function validBody(storage: FakeStorage, withGphn = true) {
  const raw = {
    cccdNumber: '079123456789',
    gender: 'FEMALE',
    yearsOfExp: 12,
    identity: {
      cccdFrontKey: upload(storage, 'kyc-cccd'),
      cccdBackKey: upload(storage, 'kyc-cccd'),
      portraitKey: upload(storage, 'kyc-selfie'),
    },
    degree: { fileKey: upload(storage, 'nurse-degree', PDF, NURSE, 'application/pdf'), issuedDate: '2010-06-30' },
    ...(withGphn
      ? {
          gphn: {
            fileKey: upload(storage, 'nurse-gphn'),
            number: '000123/HCM-GPHN',
            issuedDate: '2021-01-15',
            expiryDate: '2031-01-15',
            issuingAuthority: 'Sở Y tế TP.HCM',
            scopeOfPractice: 'Điều dưỡng đa khoa',
          },
        }
      : {}),
  };
  return submitOnboardingSchema.parse(raw);
}

async function expectAppError(p: Promise<unknown>, status: number, code: string) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  expect((err as AppError).status).toBe(status);
}

describe('detectContentType (magic bytes)', () => {
  it('recognises jpeg, png, webp, pdf and rejects anything else', () => {
    expect(detectContentType(JPEG)).toBe('image/jpeg');
    expect(detectContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectContentType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe('image/webp');
    expect(detectContentType(PDF)).toBe('application/pdf');
    expect(detectContentType(EXE)).toBe(null);
    expect(detectContentType(Buffer.from('<svg onload=alert(1)>'))).toBe(null);
  });
});

describe('todayInVietnam', () => {
  it('uses Vietnam time, not UTC', () => {
    expect(todayInVietnam(Date.parse('2026-11-03T18:30:00Z'))).toBe('2026-11-04');
  });
});

describe('upload URLs', () => {
  it('returns server-generated keys under the right category', async () => {
    const { svc } = setup();
    const res = await svc.requestUploadUrls(NURSE, {
      files: [
        { purpose: 'CCCD_FRONT', contentType: 'image/jpeg' },
        { purpose: 'GPHN', contentType: 'application/pdf' },
      ],
    });
    expect(res[0]!.objectKey.startsWith(`kyc-cccd/${NURSE}/`)).toBe(true);
    expect(res[1]!.objectKey.endsWith('.pdf')).toBe(true);
  });

  it('refuses a PDF for the portrait or CCCD (must be a photo)', async () => {
    const { svc } = setup();
    await expectAppError(
      svc.requestUploadUrls(NURSE, { files: [{ purpose: 'PORTRAIT', contentType: 'application/pdf' }] }),
      400,
      'CONTENT_TYPE_NOT_ALLOWED',
    );
  });
});

describe('submit onboarding', () => {
  it('stores the dossier as PENDING_VERIFICATION with PENDING credentials (US-HP-04 AC-01)', async () => {
    const { svc, storage, repo } = setup();
    const status = await svc.submit(NURSE, validBody(storage));
    expect(status.profileStatus).toBe(ProfileStatus.PENDING_VERIFICATION);
    expect(status.kycStatus).toBe(KycStatus.PENDING);
    expect(repo.credentials.map((c) => `${c.docType}:${c.side ?? ''}`)).toEqual(['CCCD:FRONT', 'CCCD:BACK', 'DEGREE:', 'GPHN:']);
    const gphn = repo.credentials.find((c) => c.docType === DocType.GPHN)!;
    expect(gphn.documentNumber).toBe('000123/HCM-GPHN');
    expect(gphn.expiryDate).toBe('2031-01-15');
    expect(gphn.issuingAuthority).toBe('Sở Y tế TP.HCM');
    expect(repo.identity!.kycDocuments.portraitKey.startsWith('kyc-selfie/')).toBe(true);
  });

  it('degree only (no GPHN) is a valid Tier-1 dossier', async () => {
    const { svc, storage, repo } = setup();
    await svc.submit(NURSE, validBody(storage, false));
    expect(repo.credentials.some((c) => c.docType === DocType.GPHN)).toBe(false);
  });

  it('retirement decision is stored as its own credential', async () => {
    const { svc, storage, repo } = setup();
    const body = validBody(storage, false);
    body.retirementDecision = { fileKey: upload(storage, 'nurse-retirement', PDF, NURSE, 'application/pdf') };
    await svc.submit(NURSE, body);
    expect(repo.credentials.some((c) => c.docType === DocType.RETIREMENT_DECISION)).toBe(true);
  });

  it('rejects an expired GPHN', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.gphn!.expiryDate = '2026-11-03'; // expires today = no longer valid
    await expectAppError(svc.submit(NURSE, body), 400, 'GPHN_EXPIRED');
  });

  it('rejects an issue date in the future', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.degree.issuedDate = '2027-01-01';
    await expectAppError(svc.submit(NURSE, body), 400, 'ISSUED_DATE_IN_FUTURE');
  });

  it("rejects another user's file key", async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.identity.portraitKey = upload(storage, 'kyc-selfie', JPEG, OTHER);
    await expectAppError(svc.submit(NURSE, body), 400, 'INVALID_FILE_KEY');
  });

  it('rejects a key uploaded for another purpose (portrait reused as degree)', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.degree.fileKey = upload(storage, 'kyc-selfie');
    await expectAppError(svc.submit(NURSE, body), 400, 'INVALID_FILE_KEY');
  });

  it('rejects a key that was never uploaded', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.degree.fileKey = buildObjectKey('nurse-degree', NURSE, 'image/jpeg');
    await expectAppError(svc.submit(NURSE, body), 400, 'FILE_NOT_UPLOADED');
  });

  it('rejects a file over the size limit', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    storage.put(body.degree.fileKey, PDF, 11 * 1024 * 1024);
    await expectAppError(svc.submit(NURSE, body), 400, 'FILE_TOO_LARGE');
  });

  it('rejects an executable disguised as a photo (magic bytes, SEC-7.1)', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    storage.put(body.identity.portraitKey, EXE);
    await expectAppError(svc.submit(NURSE, body), 400, 'FILE_TYPE_NOT_ALLOWED');
  });

  it('rejects a PDF as the portrait even if uploaded under the portrait key', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    storage.put(body.identity.portraitKey, PDF);
    await expectAppError(svc.submit(NURSE, body), 400, 'FILE_TYPE_NOT_ALLOWED');
  });

  it('rejects the same file used for CCCD front and back', async () => {
    const { svc, storage } = setup();
    const body = validBody(storage);
    body.identity.cccdBackKey = body.identity.cccdFrontKey;
    await expectAppError(svc.submit(NURSE, body), 400, 'DUPLICATE_FILE');
  });

  it('a second submission while the first is under review is refused', async () => {
    const { svc, storage } = setup();
    await svc.submit(NURSE, validBody(storage));
    await expectAppError(svc.submit(NURSE, validBody(storage)), 409, 'ONBOARDING_ALREADY_SUBMITTED');
  });

  it('resubmission is allowed after the Admin rejected the documents', async () => {
    const { svc, storage, repo } = setup();
    await svc.submit(NURSE, validBody(storage));
    for (const c of repo.credentials) c.status = VerificationStatus.REJECTED;
    const body = validBody(storage);
    body.yearsOfExp = 13;
    await svc.submit(NURSE, body);
    expect(repo.credentials.filter((c) => c.status === VerificationStatus.PENDING)).toHaveLength(4);
    expect(repo.profile!.years).toBe(13);
  });

  it('an ACTIVE nurse cannot re-onboard (409) and a BANNED one is refused (403)', async () => {
    const { svc, storage, repo } = setup();
    repo.profile = { status: ProfileStatus.ACTIVE, years: 5 };
    await expectAppError(svc.submit(NURSE, validBody(storage)), 409, 'ALREADY_VERIFIED');
    repo.profile = { status: ProfileStatus.BANNED, years: 5 };
    await expectAppError(svc.submit(NURSE, validBody(storage)), 403, 'ACCOUNT_BANNED');
  });

  it('a CCCD number already used by another account → 409, and nothing is written', async () => {
    const { svc, storage, repo } = setup();
    repo.takenCccd.add('079123456789');
    await expectAppError(svc.submit(NURSE, validBody(storage)), 409, 'CCCD_ALREADY_REGISTERED');
    expect(repo.profile).toBe(null); // rolled back
    expect(repo.credentials).toHaveLength(0);
  });
});

describe('schema', () => {
  it('rejects bad CCCD numbers, impossible dates and unknown fields', () => {
    const base = {
      cccdNumber: '079123456789',
      yearsOfExp: 1,
      identity: { cccdFrontKey: 'k'.repeat(20), cccdBackKey: 'l'.repeat(20), portraitKey: 'm'.repeat(20) },
      degree: { fileKey: 'n'.repeat(20) },
    };
    expect(submitOnboardingSchema.safeParse(base).success).toBe(true);
    expect(submitOnboardingSchema.safeParse({ ...base, cccdNumber: '12345' }).success).toBe(false);
    expect(submitOnboardingSchema.safeParse({ ...base, degree: { fileKey: 'n'.repeat(20), issuedDate: '2023-02-30' } }).success).toBe(false);
    expect(submitOnboardingSchema.safeParse({ ...base, tier: 'TIER_2_SPECIALIST' }).success).toBe(false);
  });
});
