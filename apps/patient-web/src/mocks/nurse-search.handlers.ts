/**
 * Mock GET /nurses/search (FR-SEARCH-01) — contract đề xuất, xem features/nurse-search/nurse-search.types.ts.
 * Lọc theo dịch vụ (dịch vụ xâm lấn → chỉ Tier 2), quận, Tier, giới tính, khung giờ.
 * Khung giờ: điều dưỡng có `busy` trùng khoảng yêu cầu thì bị loại (giả lập time-off / ca đã nhận).
 */

import type { NurseSummary } from '../features/nurse-search/nurse-search.types';
import { SERVICE_CATEGORIES } from '../features/nurse-search/nurse-search.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { userIdFromHeaders } from './mock-db';

export type MockNurse = NurseSummary & { busy: Array<{ from: string; to: string }> };

const BASIC = ['BEDSIDE_CARE', 'HYGIENE_FEEDING', 'VITAL_SIGNS'];
const ADVANCED = [...BASIC, 'INJECTION', 'IV_INFUSION', 'WOUND_DRESSING', 'CATHETER_CARE'];

export const NURSES: MockNurse[] = [
  {
    nurseId: 'n-mai', fullName: 'Trần Thị Mai', avatarUrl: null, gender: 'FEMALE', tier: 'TIER_2_SPECIALIST',
    trustScore: 98, ratingAvg: 4.9, ratingCount: 112, completedShifts: 128, yearsExperience: 25, isRetiredStaff: true,
    districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà'], services: ADVANCED,
    bio: 'Nguyên điều dưỡng trưởng khoa Ngoại, hơn 25 năm kinh nghiệm chăm sóc bệnh nhân hậu phẫu và người cao tuổi.',
    distanceKm: 1.2, busy: [],
  },
  {
    nurseId: 'n-ha', fullName: 'Phạm Thu Hà', avatarUrl: null, gender: 'FEMALE', tier: 'TIER_2_SPECIALIST',
    trustScore: 95, ratingAvg: 4.8, ratingCount: 80, completedShifts: 95, yearsExperience: 9, isRetiredStaff: false,
    districts: ['Hải Châu', 'Cẩm Lệ'], services: ADVANCED,
    bio: 'Cử nhân Điều dưỡng chuyên ngành Phục hồi chức năng, thành thạo thủ thuật y tế tại nhà theo y lệnh.',
    distanceKm: 2.6, busy: [{ from: '2000-01-01T00:00:00Z', to: '2000-01-01T00:00:01Z' }],
  },
  {
    nurseId: 'n-hung', fullName: 'Nguyễn Văn Hùng', avatarUrl: null, gender: 'MALE', tier: 'TIER_1_BASIC',
    trustScore: 90, ratingAvg: 4.7, ratingCount: 31, completedShifts: 42, yearsExperience: 3, isRetiredStaff: false,
    districts: ['Sơn Trà', 'Ngũ Hành Sơn'], services: BASIC,
    bio: 'Tốt nghiệp Trung cấp Điều dưỡng, chu đáo và kiên nhẫn với người bệnh suy giảm vận động.',
    distanceKm: 3.1, busy: [],
  },
  {
    nurseId: 'n-lan', fullName: 'Lê Thị Lan', avatarUrl: null, gender: 'FEMALE', tier: 'TIER_1_BASIC',
    trustScore: 100, ratingAvg: null, ratingCount: 0, completedShifts: 0, yearsExperience: 1, isRetiredStaff: false,
    districts: ['Liên Chiểu', 'Thanh Khê'], services: BASIC,
    bio: 'Vừa tốt nghiệp Cao đẳng Điều dưỡng, nhiệt tình, nhận ca chăm sóc cơ bản.',
    distanceKm: 6.4, busy: [],
  },
  {
    nurseId: 'n-tam', fullName: 'Võ Minh Tâm', avatarUrl: null, gender: 'MALE', tier: 'TIER_2_SPECIALIST',
    trustScore: 82, ratingAvg: 4.5, ratingCount: 24, completedShifts: 40, yearsExperience: 30, isRetiredStaff: true,
    districts: ['Hòa Vang', 'Liên Chiểu', 'Cẩm Lệ'], services: ADVANCED,
    bio: 'Bác sĩ đã nghỉ hưu, nhận chăm sóc hậu phẫu và theo dõi bệnh mạn tính tại nhà.',
    distanceKm: 9.8,
    // Bận cả ngày 2026-12-01 theo giờ địa phương (UTC+7)
    busy: [{ from: '2026-11-30T17:00:00Z', to: '2026-12-01T17:00:00Z' }],
  },
];

const strip = ({ busy: _busy, ...pub }: MockNurse): NurseSummary => pub;

export const nurseSearchHandlers: Record<string, MockHandler> = {
  'GET /api/v1/nurses/search': (_body, { headers, query }) => {
    if (!userIdFromHeaders(headers)) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

    const service = query.get('serviceCode');
    const district = query.get('district');
    const tier = query.get('tier');
    const gender = query.get('gender');
    const startAt = query.get('startAt');
    const endAt = query.get('endAt');
    const limit = Math.min(Number(query.get('limit')) || 12, 100);
    const offset = Number(query.get('offset')) || 0;

    if (service && !SERVICE_CATEGORIES.some((s) => s.code === service)) {
      return fail(400, 'VALIDATION_ERROR', 'Dịch vụ không hợp lệ.');
    }
    if ((startAt && !endAt) || (!startAt && endAt) || (startAt && endAt && endAt <= startAt)) {
      return fail(400, 'VALIDATION_ERROR', 'Khung giờ không hợp lệ.');
    }

    const result = NURSES.filter((n) => {
      if (service && !n.services.includes(service)) return false;
      if (district && !n.districts.includes(district)) return false;
      if (tier && n.tier !== tier) return false;
      if (gender && n.gender !== gender) return false;
      if (startAt && endAt && n.busy.some((b) => b.from < endAt && b.to > startAt)) return false;
      return true;
    }).sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));

    return ok({
      items: result.slice(offset, offset + limit).map(strip),
      total: result.length,
      limit,
      offset,
    });
  },
};
