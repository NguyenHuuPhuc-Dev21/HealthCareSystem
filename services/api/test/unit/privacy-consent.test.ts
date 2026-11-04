import { describe, it, expect } from 'vitest';
import type { Queryable } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { assertConsentActive, captureConsent } from '../../src/modules/privacy-consent/privacy-consent.service';

const PROFILE_ID = '30000000-0000-0000-0000-000000000001';
const FIXED_NOW = new Date('2026-11-03T08:00:00.000Z');

/** DB giả: trả về `rows` cho mọi câu query và ghi lại các câu đã chạy. */
function fakeDb(rows: unknown[]) {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const db = {
    async query(text: string, params: unknown[] = []) {
      calls.push({ text, params });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Queryable;
  return { db, calls };
}

/** Bắt lỗi AppError để kiểm tra status + code. */
async function caught(fn: () => unknown): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('expected an AppError to be thrown');
}

describe('privacy-consent captureConsent (unit)', () => {
  it('trả về đúng các cột consent, timestamp lấy giờ SERVER', () => {
    const cols = captureConsent({ accepted: true, ip: '203.0.113.7', deviceId: 'android-abc' }, () => FIXED_NOW);
    expect(cols).toEqual({
      data_consent_accepted: true,
      consent_timestamp: FIXED_NOW,
      consent_ip: '203.0.113.7',
      consent_device_id: 'android-abc',
    });
  });

  it('chặn 400 CONSENT_REQUIRED khi không tích, thiếu, hoặc gửi chuỗi "true"', async () => {
    for (const accepted of [false, undefined, null, 'true', 1]) {
      const err = await caught(() => captureConsent({ accepted, ip: null, deviceId: null }));
      expect(err.status).toBe(400);
      expect(err.code).toBe('CONSENT_REQUIRED');
    }
  });

  it('IP/thiết bị: cắt khoảng trắng, chuỗi rỗng thành null', () => {
    const cols = captureConsent({ accepted: true, ip: '  ', deviceId: '  ios-1  ' }, () => FIXED_NOW);
    expect(cols.consent_ip).toBeNull();
    expect(cols.consent_device_id).toBe('ios-1');
  });

  it('IP hoặc thiết bị dài quá cột DB thì báo 400', async () => {
    const longIp = await caught(() => captureConsent({ accepted: true, ip: 'x'.repeat(46), deviceId: null }));
    expect(longIp.status).toBe(400);
    const longDevice = await caught(() => captureConsent({ accepted: true, ip: null, deviceId: 'd'.repeat(256) }));
    expect(longDevice.status).toBe(400);
  });
});

describe('privacy-consent assertConsentActive (unit)', () => {
  it('hồ sơ còn đồng ý thì cho qua, SQL có tham số $1', async () => {
    const { db, calls } = fakeDb([{ id: PROFILE_ID, data_consent_accepted: true, deleted_at: null }]);
    await assertConsentActive(db, PROFILE_ID);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/WHERE id = \$1/);
    expect(calls[0].params).toEqual([PROFILE_ID]);
  });

  it('id không phải UUID: 404 và KHÔNG chạm DB', async () => {
    const { db, calls } = fakeDb([]);
    const err = await caught(() => assertConsentActive(db, 'abc'));
    expect(err.status).toBe(404);
    expect(err.code).toBe('PATIENT_PROFILE_NOT_FOUND');
    expect(calls).toHaveLength(0);
  });

  it('không tìm thấy hồ sơ: 404', async () => {
    const { db } = fakeDb([]);
    const err = await caught(() => assertConsentActive(db, PROFILE_ID));
    expect(err.status).toBe(404);
  });

  it('hồ sơ đã xóa mềm (deleted_at): 404', async () => {
    const { db } = fakeDb([{ id: PROFILE_ID, data_consent_accepted: true, deleted_at: FIXED_NOW }]);
    const err = await caught(() => assertConsentActive(db, PROFILE_ID));
    expect(err.status).toBe(404);
  });

  it('đã rút đồng ý: 403 CONSENT_REQUIRED', async () => {
    const { db } = fakeDb([{ id: PROFILE_ID, data_consent_accepted: false, deleted_at: null }]);
    const err = await caught(() => assertConsentActive(db, PROFILE_ID));
    expect(err.status).toBe(403);
    expect(err.code).toBe('CONSENT_REQUIRED');
  });
});