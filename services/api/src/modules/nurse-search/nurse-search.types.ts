/**
 * Types for nurse-search (BE-3 · Phase 2 · FR-SEARCH-01). Contract: docs/api/nurse-search.api.md
 */
import type { Gender, NurseTier } from '@healthcare-system/shared';
import type { NurseGateRow } from '../matching-radar/matching-radar.types';

/** Sort orders a patient can pick. */
export type SearchSort = 'distance' | 'rating' | 'experience';

/**
 * A search candidate: the SAME gate columns matching-radar reads (so the eligibility answer is identical)
 * plus the public card fields.
 */
export type NurseSearchRow = NurseGateRow & {
  full_name: string;
  avatar_url: string | null;
  gender: Gender | null;
  years_of_exp: number;
  is_retired_medical_staff: boolean;
  rating_avg: string | number;
  review_count: string | number;
};

/** service_categories row as search needs it. */
export type SearchServiceRow = {
  id: string;
  code: string;
  is_invasive: boolean;
  is_prohibited: boolean;
  is_active: boolean;
  required_tier: NurseTier;
};

export type ReviewRow = { rating: number; comment: string | null; created_at: Date };

/** Public nurse card (FR-SEARCH-01 item 2). No phone, email, exact position, trust score or wallet data. */
export interface NurseCardDto {
  nurseId: string;
  fullName: string;
  avatarUrl: string | null;
  gender: Gender | null;
  /** Tier that counts on the requested shift date (Tier 2 only if the GPHN is still valid that day). */
  tier: NurseTier;
  isRetiredMedicalStaff: boolean;
  yearsOfExperience: number;
  ratingAvg: number;
  reviewCount: number;
  distanceKm: number;
  /** false = nurse is in the deposit grace period → can only take BANK_TRANSFER bookings (ADR-0004 D2). */
  cashAllowed: boolean;
}

export interface NurseSearchResult {
  items: NurseCardDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ReviewDto {
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface NurseProfileDto extends Omit<NurseCardDto, 'distanceKm' | 'cashAllowed'> {
  reviews: ReviewDto[];
}
