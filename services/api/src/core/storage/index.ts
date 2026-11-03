/**
 * Core Private Object Storage (BE-1 / Dev A)
 * S3-compatible (MinIO locally, S3 in cloud). The bucket is PRIVATE: CCCD,
 * GPHN, doctor's orders, selfies and dispute evidence are only ever reached
 * through short-lived presigned URLs (SRS §6 NFR-SEC-01, max 10 minutes).
 *
 * Upload flow every module should follow (e.g. nurse-onboarding):
 *   1. API builds a key with buildObjectKey() and returns createUploadUrl(key, contentType).
 *   2. Client PUTs the file straight to storage (the API never proxies bytes).
 *   3. Client sends the key back; API calls statObject(key) to confirm the file
 *      exists, its size and content type, BEFORE writing the key to the DB.
 *   4. The DB stores only the object key — never a URL.
 *   5. Reads go through createDownloadUrl(key) after the module's policy check,
 *      and sensitive reads are audit-logged by the caller.
 */

import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRESIGNED_URL_MAX_EXPIRY_SECONDS } from '@healthcare-system/shared';

export type StorageCategory =
  | 'kyc-cccd'
  | 'kyc-selfie'
  | 'nurse-degree'
  | 'nurse-gphn'
  | 'nurse-retirement'
  | 'prescription'
  | 'checkin-selfie'
  | 'prescription-rejection'
  | 'dispute-evidence';

/** Content types accepted for upload (images + PDF scans). */
export const ALLOWED_UPLOAD_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Per-file upload limit (SEC-7.1 retained engineering standard: max 10 MB per file). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Detects the real file type from its first bytes (SEC-7.1: check magic bytes,
 * not only the declared MIME type). Returns null for anything not whitelisted.
 */
export function detectContentType(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  if (head.length >= 5 && head.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

export interface PresignedUrlResult {
  url: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | undefined;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z-]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i;
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** `<category>/<ownerUserId>/<random uuid>.<ext>` — no user-supplied file names. */
export function buildObjectKey(category: StorageCategory, ownerUserId: string, contentType: string): string {
  if (!UUID_RE.test(ownerUserId)) throw new StorageError('ownerUserId must be a UUID');
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) throw new StorageError(`Content type not allowed: ${contentType}`);
  return `${category}/${ownerUserId.toLowerCase()}/${randomUUID()}.${ext}`;
}

/** True only for keys produced by buildObjectKey (blocks "../" and foreign paths). */
export function isValidObjectKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Owner check helper: the key's second segment is the uploader's user id. */
export function objectKeyBelongsTo(key: string, userId: string): boolean {
  return isValidObjectKey(key) && key.split('/')[1] === userId.toLowerCase();
}

function clampExpiry(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds <= 0) throw new StorageError('expiry must be a positive integer');
  return Math.min(seconds, PRESIGNED_URL_MAX_EXPIRY_SECONDS);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new StorageError(`${name} is not set (see services/api/.env.example)`);
  return v;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.STORAGE_REGION ?? 'ap-southeast-1',
      endpoint: process.env.STORAGE_ENDPOINT || undefined, // set for MinIO, unset for AWS S3
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: required('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: required('STORAGE_SECRET_ACCESS_KEY'),
      },
    });
  }
  return client;
}

function bucket(): string {
  return required('STORAGE_BUCKET_NAME');
}

/** Presigned PUT. The signed Content-Type must match what the client sends. */
export async function createUploadUrl(
  objectKey: string,
  contentType: string,
  expirySeconds: number = PRESIGNED_URL_MAX_EXPIRY_SECONDS,
): Promise<PresignedUrlResult> {
  if (!isValidObjectKey(objectKey)) throw new StorageError('Invalid object key');
  if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) throw new StorageError(`Content type not allowed: ${contentType}`);
  const expiresIn = clampExpiry(expirySeconds);
  const url = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: objectKey, ContentType: contentType }),
    { expiresIn },
  );
  return { url, objectKey, expiresInSeconds: expiresIn };
}

/** Presigned GET. Call only after the caller's policy check passed. */
export async function createDownloadUrl(
  objectKey: string,
  expirySeconds: number = PRESIGNED_URL_MAX_EXPIRY_SECONDS,
): Promise<PresignedUrlResult> {
  if (!isValidObjectKey(objectKey)) throw new StorageError('Invalid object key');
  const expiresIn = clampExpiry(expirySeconds);
  const url = await getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: objectKey }), {
    expiresIn,
  });
  return { url, objectKey, expiresInSeconds: expiresIn };
}

/** Reads the first `bytes` of an object (for magic-byte checks); null if missing. */
export async function readObjectHead(objectKey: string, bytes = 16): Promise<Buffer | null> {
  if (!isValidObjectKey(objectKey)) throw new StorageError('Invalid object key');
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: bucket(), Key: objectKey, Range: `bytes=0-${bytes - 1}` }),
    );
    const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) return Buffer.alloc(0);
    return Buffer.from(await body.transformToByteArray());
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}

/** Returns size/content type, or null if the object does not exist. */
export async function statObject(objectKey: string): Promise<ObjectInfo | null> {
  if (!isValidObjectKey(objectKey)) throw new StorageError('Invalid object key');
  try {
    const head = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }));
    return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}
