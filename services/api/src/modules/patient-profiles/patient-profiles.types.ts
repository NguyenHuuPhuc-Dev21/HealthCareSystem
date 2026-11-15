/**
 * Types for patient-profiles (BE-2 · Phase 1 · FR-AUTH-03, US-HP-06).
 * Status enums come from packages/shared; only module-local shapes live here.
 */
import type { Gender, KycStatus, LocationType, MobilityStatus } from '@healthcare-system/shared';

// ---- Customer eKYC ------------------------------------------------------------

export type EkycUploadPurpose = 'CCCD_FRONT' | 'CCCD_BACK' | 'PORTRAIT';

/**
 * users.kyc_documents for a PATIENT. The three keys use the same names as nurse onboarding
 * (credential-review's dossier reads them), the review fields are only written by an Admin.
 */
export interface CustomerKycDocuments {
  cccdFrontKey: string;
  cccdBackKey: string;
  portraitKey: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decision?: 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
}

/** Row read when locking / reading a customer's identity (a `type` to satisfy QueryResultRow). */
export type CustomerIdentityRow = {
  id: string;
  role: string;
  full_name: string;
  phone: string;
  kyc_status: KycStatus;
  cccd_number: string | null;
  kyc_documents: CustomerKycDocuments | null;
};

/** GET /patient/ekyc — never returns object keys or the full CCCD number. */
export interface EkycStatusView {
  kycStatus: KycStatus;
  cccdNumberMasked: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface EkycQueueItem {
  customerId: string;
  fullName: string;
  phone: string;
  submittedAt: string | null;
}

/** GET /admin/customers/:id/ekyc — files as 10-minute links. */
export interface EkycDossierView {
  customerId: string;
  fullName: string;
  phone: string;
  kycStatus: KycStatus;
  cccdNumber: string | null;
  submittedAt: string | null;
  identityFiles: { cccdFrontUrl: string | null; cccdBackUrl: string | null; portraitUrl: string | null };
  linksExpireInSeconds: number;
}

export interface UploadUrlView {
  purpose: EkycUploadPurpose;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  contentType: string;
}

// ---- Patient profiles -----------------------------------------------------------

/** Row of patient_profiles as this module reads it. */
export type PatientProfileRow = {
  id: string;
  customer_id: string;
  full_name: string;
  dob: string | null; // to_char YYYY-MM-DD
  gender: Gender | null;
  weight_kg: string | number | null; // NUMERIC comes back as string
  mobility_status: MobilityStatus;
  medical_history: string | null;
  is_infectious: boolean;
  address_text: string | null;
  location_type: LocationType;
  lat: string | number | null;
  lng: string | number | null;
  data_consent_accepted: boolean;
  consent_timestamp: Date | null;
  consent_withdrawn_at: Date | null;
  created_at: Date;
};

/** Full view for the owner (GET /patient-profiles/:id, POST, PATCH). */
export interface PatientProfileView {
  id: string;
  fullName: string;
  dob: string | null;
  gender: Gender | null;
  weightKg: number | null;
  mobilityStatus: MobilityStatus;
  medicalHistory: string | null;
  isInfectious: boolean;
  addressText: string | null;
  locationType: LocationType;
  lat: number | null;
  lng: number | null;
  consent: { accepted: boolean; acceptedAt: string | null; withdrawnAt: string | null };
  createdAt: string;
}

/** List item (GET /patient-profiles) — no medical history in lists (need-to-know). */
export type PatientProfileSummary = Omit<PatientProfileView, 'medicalHistory'>;

/** Columns the create/update SQL writes (camelCase in, mapped in the repo). */
export interface ProfileFields {
  fullName: string;
  dob: string | null;
  gender: Gender | null;
  weightKg: number | null;
  mobilityStatus: MobilityStatus;
  medicalHistory: string | null;
  isInfectious: boolean;
  addressText: string;
  locationType: LocationType;
  lat: number;
  lng: number;
}

/** What bookings (Phase 3) gets back from assertCanBookForProfile. */
export interface BookableProfile {
  patientProfileId: string;
  locationType: LocationType;
  weightKg: number | null;
  mobilityStatus: MobilityStatus;
  lat: number | null;
  lng: number | null;
}
