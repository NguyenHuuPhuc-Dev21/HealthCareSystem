import type { DisputeStatus } from '../enums';

export type DisputeCategory =
  | 'PREMATURE_ABANDONMENT'
  | 'CLINICAL_PROTOCOL_VIOLATION'
  | 'UNPROFESSIONAL_CONDUCT'
  | 'FALSE_CLINICAL_DECLARATION';

export interface DisputeEvidenceDto {
  id: string;
  url: string;
  kind: 'IMAGE' | 'VIDEO';
  uploadedBy: 'PATIENT' | 'NURSE';
  fileName?: string;
  fileSizeBytes?: number;
}

export interface DisputeDto {
  id: string;
  bookingId: string;
  bookingCode: string;
  openedBy: 'PATIENT' | 'NURSE';
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  evidences: DisputeEvidenceDto[];
  nurseRebuttal?: {
    content: string;
    submittedAt: string;
    evidences?: DisputeEvidenceDto[];
  } | null;
  rebuttalDueAt?: string;
  resolution?: {
    outcome: DisputeStatus;
    note: string;
    trustScoreDelta?: number;
    depositDeducted?: number;
    resolvedAt: string;
    refundedToPatient?: boolean;
    releasedToNurse?: boolean;
  } | null;
  kind?: 'BOOKING' | 'PENALTY_APPEAL'; // PENALTY_APPEAL: điều dưỡng khiếu nại một khoản trừ ký quỹ (ADR-0004 D3)
  appealedTransactionId?: string; // khoản PENALTY_DEDUCT bị khiếu nại
  penaltyAmount?: number;
  penaltyReason?: string;
  slaRule?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OpenDisputeInput {
  category: DisputeCategory;
  description: string;
  evidenceUrls?: string[];
}

export interface SubmitRebuttalInput {
  content: string;
  evidenceUrls?: string[];
}

export interface PresignedUploadUrlDto {
  fileId: string;
  fileName: string;
  uploadUrl: string;
  publicUrl: string;
}
