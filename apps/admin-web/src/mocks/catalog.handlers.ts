/**
 * Mock danh mục dịch vụ — contract ĐỀ XUẤT (features/catalog/catalog.types.ts):
 *   GET   /admin/services/categories
 *   POST  /admin/services/categories           → 201; 400 VALIDATION_ERROR | INVALID_TIER_FOR_INVASIVE · 409 CODE_EXISTS
 *   PATCH /admin/services/categories/:id       → 404 SERVICE_NOT_FOUND
 */

import type { ServiceCategory, ServiceInput } from '../features/catalog/catalog.types';
import { CODE_PATTERN } from '../features/catalog/catalog.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData } from './mock-db';

const now = () => new Date().toISOString();
const old = '2026-09-01T00:00:00.000Z';

function svc(code: string, name: string, p: Partial<ServiceCategory>): ServiceCategory {
  return {
    id: `svc-${code.toLowerCase()}`, code, name, serviceType: 'TASK_BASED', isInvasive: false, isProhibited: false, requiredTier: 'TIER_1_BASIC',
    basePrice: 100_000, unit: 'PER_TIME', isActive: true, createdAt: old, updatedAt: old, ...p,
  };
}

const seed = (): ServiceCategory[] => [
  svc('SRV_SHIFT_4H', 'Ca chăm sóc 4 giờ', { serviceType: 'SHIFT_BASED', unit: 'PER_HOUR', basePrice: 100_000 }),
  svc('SRV_SHIFT_8H', 'Ca chăm sóc 8 giờ ban ngày', { serviceType: 'SHIFT_BASED', unit: 'PER_HOUR', basePrice: 90_000 }),
  svc('SRV_HYGIENE', 'Vệ sinh cá nhân, hỗ trợ ăn uống', { unit: 'PER_HOUR', serviceType: 'SHIFT_BASED', basePrice: 85_000 }),
  svc('SRV_VITALS', 'Theo dõi sinh hiệu tại nhà', { basePrice: 120_000 }),
  svc('SRV_IM_INJECTION', 'Tiêm bắp / dưới da theo y lệnh', { isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 150_000 }),
  svc('SRV_IV_INFUSION', 'Truyền dịch duy trì theo y lệnh', { isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 250_000 }),
  svc('SRV_WOUND_CARE', 'Thay băng, cắt chỉ', { isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 180_000 }),
  svc('SRV_CATHETER', 'Chăm sóc ống thông', { isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 200_000, isActive: false }),
  svc('SRV_BLOOD_TRANSFUSION', 'Truyền máu / huyết tương tại nhà', { isProhibited: true, isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 0, isActive: false }),
  svc('SRV_IV_ANTIBIOTIC', 'Kháng sinh đường tĩnh mạch (nguy cơ sốc phản vệ)', { isProhibited: true, isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 0, isActive: false }),
  svc('SRV_MINOR_SURGERY', 'Tiểu phẫu / gây mê tại nhà', { isProhibited: true, isInvasive: true, requiredTier: 'TIER_2_SPECIALIST', basePrice: 0, isActive: false }),
];

const load = () => getUserData<ServiceCategory[]>('admin', 'services', seed());
const save = (l: ServiceCategory[]) => setUserData('admin', 'services', l);
const hasToken = (h: Headers) => (h.get('Authorization') ?? '').startsWith('Bearer ');
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

function validate(b: Partial<ServiceInput>, creating: boolean) {
  if (creating && !CODE_PATTERN.test(b.code ?? '')) return fail(400, 'VALIDATION_ERROR', 'Mã dịch vụ gồm chữ HOA, số, gạch dưới (3–50 ký tự, bắt đầu bằng chữ).');
  if (b.name !== undefined && (b.name.trim().length < 3 || b.name.length > 150)) return fail(400, 'VALIDATION_ERROR', 'Tên dịch vụ từ 3 đến 150 ký tự.');
  if (b.basePrice !== undefined && (!Number.isInteger(b.basePrice) || b.basePrice < 0)) return fail(400, 'VALIDATION_ERROR', 'Giá cơ bản phải là số nguyên VNĐ không âm.');
  return null;
}

export const catalogHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/services/categories': (_b, { headers }) => {
    if (!hasToken(headers)) return unauthorized();
    return ok({ items: load() });
  },

  'POST /api/v1/admin/services/categories': (body: ServiceInput, { headers }) => {
    if (!hasToken(headers)) return unauthorized();
    const bad = validate(body, true);
    if (bad) return bad;
    if (body.isInvasive && body.requiredTier !== 'TIER_2_SPECIALIST') return fail(400, 'INVALID_TIER_FOR_INVASIVE', 'Dịch vụ xâm lấn chỉ dành cho Cấp 2.');
    const list = load();
    if (list.some((s) => s.code === body.code)) return fail(409, 'CODE_EXISTS', `Mã ${body.code} đã tồn tại.`);
    const item: ServiceCategory = { ...body, name: body.name.trim(), id: `svc-${crypto.randomUUID()}`, createdAt: now(), updatedAt: now(), isActive: body.isProhibited ? false : body.isActive };
    save([...list, item]);
    return { status: 201, body: { success: true, data: item } };
  },

  'PATCH /api/v1/admin/services/categories/:id': (body: Partial<ServiceInput>, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const list = load();
    const i = list.findIndex((s) => s.id === params.id);
    if (i < 0) return fail(404, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.');
    const bad = validate(body, false);
    if (bad) return bad;
    const next = { ...list[i], ...body, code: list[i].code, updatedAt: now() };
    if (next.isInvasive && next.requiredTier !== 'TIER_2_SPECIALIST') return fail(400, 'INVALID_TIER_FOR_INVASIVE', 'Dịch vụ xâm lấn chỉ dành cho Cấp 2.');
    if (next.isProhibited) next.isActive = false;
    list[i] = next;
    save(list);
    return ok(next);
  },
};
