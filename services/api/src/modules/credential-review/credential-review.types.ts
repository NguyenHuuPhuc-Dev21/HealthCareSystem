import type {
  DocType,
  Gender,
  KycStatus,
  NurseTier,
  ProfileStatus,
  VerificationStatus,
} from '@healthcare-system/shared';

export type Decision = 'APPROVED' | 'REJECTED';

export interface ReviewDecision {
  credentialId: string;
  decision: Decision;
  rejectionReason?: string;
}

/** A credential row still waiting for review (locked FOR UPDATE during a review). */
export interface PendingCredential {
  id: string;
  docType: DocType;
  side: 'FRONT' | 'BACK' | null;
  documentNumber: string | null;
  expiryDate: string | null; // YYYY-MM-DD
  scopeOfPractice: string | null;
}

/** The nurse_profiles fields a review reads/changes (locked FOR UPDATE). */
export interface LockedProfile {
  profileStatus: ProfileStatus;
  tier: NurseTier;
  gphnNumber: string | null;
  gphnExpiryDate: string | null; // YYYY-MM-DD, approved data only
  scopeOfPractice: string | null;
  isRetiredMedicalStaff: boolean;
}

export interface ReviewOutcome {
  profileStatus: ProfileStatus;
  tier: NurseTier;
  /** Only set on the first (onboarding) review. */
  kycStatus?: KycStatus;
  /** Approved GPHN data to copy into nurse_profiles. */
  approvedGphn?: { number: string; expiryDate: string; scopeOfPractice: string | null };
  isRetiredMedicalStaff: boolean;
  activated: boolean;
}

export interface QueueItem {
  nurseId: string;
  fullName: string;
  phone: string;
  profileStatus: ProfileStatus;
  tier: NurseTier;
  pendingCount: number;
  hasPendingGphn: boolean;
  oldestPendingAt: string;
  /** ONBOARDING = first dossier, RENEWAL = already-active nurse sending a new document. */
  kind: 'ONBOARDING' | 'RENEWAL';
}

export interface DossierCredential {
  id: string;
  docType: DocType;
  side: 'FRONT' | 'BACK' | null;
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  scopeOfPractice: string | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  fileKey: string;
}

export interface DossierRecord {
  nurseId: string;
  fullName: string;
  phone: string;
  gender: Gender | null;
  cccdNumber: string | null;
  kycStatus: KycStatus;
  kycDocuments: { cccdFrontKey?: string; cccdBackKey?: string; portraitKey?: string } | null;
  profile: LockedProfile & { yearsOfExp: number; trustScore: number };
  credentials: DossierCredential[];
}

export interface ReviewRepo {
  lockProfile(nurseId: string): Promise<LockedProfile | null>;
  lockPendingCredentials(nurseId: string): Promise<PendingCredential[]>;
  saveDecisions(nurseId: string, reviewerId: string, decisions: ReviewDecision[]): Promise<void>;
  updateProfile(nurseId: string, outcome: ReviewOutcome): Promise<void>;
  setKycStatus(nurseId: string, kycStatus: KycStatus): Promise<void>;
  insertAudit(entry: {
    actorId: string;
    action: 'APPROVE_GPHN';
    targetId: string;
    oldValue: unknown;
    newValue: unknown;
    ip: string | null;
  }): Promise<void>;
  /** GPHN renewal (nurse side). */
  insertGphn(
    nurseId: string,
    g: { fileKey: string; number: string; issuedDate: string; expiryDate: string; issuingAuthority: string; scopeOfPractice: string },
  ): Promise<void>;
}

export interface ReviewReadRepo {
  listQueue(limit: number, offset: number): Promise<QueueItem[]>;
  getDossier(nurseId: string): Promise<DossierRecord | null>;
}
