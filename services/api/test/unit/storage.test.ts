import { describe, expect, it } from 'vitest';
import { buildObjectKey, isValidObjectKey, objectKeyBelongsTo, StorageError } from '../../src/core/storage';

const OWNER = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

describe('object keys', () => {
  it('builds <category>/<owner>/<uuid>.<ext> from the content type', () => {
    const key = buildObjectKey('nurse-gphn', OWNER, 'image/jpeg');
    expect(key).toMatch(new RegExp(`^nurse-gphn/${OWNER}/[0-9a-f-]{36}\\.jpg$`));
    expect(isValidObjectKey(key)).toBe(true);
    expect(objectKeyBelongsTo(key, OWNER)).toBe(true);
    expect(objectKeyBelongsTo(key, '00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('rejects disallowed content types and non-UUID owners', () => {
    expect(() => buildObjectKey('kyc-cccd', OWNER, 'text/html')).toThrow(StorageError);
    expect(() => buildObjectKey('kyc-cccd', '../etc', 'image/png')).toThrow(StorageError);
  });

  it('rejects keys that were not produced by buildObjectKey', () => {
    expect(isValidObjectKey('../secrets.pdf')).toBe(false);
    expect(isValidObjectKey(`nurse-gphn/${OWNER}/../../x.jpg`)).toBe(false);
    expect(isValidObjectKey('https://evil.example/x.jpg')).toBe(false);
  });
});
