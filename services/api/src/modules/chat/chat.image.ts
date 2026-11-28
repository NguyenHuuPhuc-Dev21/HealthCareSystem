/**
 * chat — photo messages (BE-2 · Phase 6 · FR-CHAT-01).
 *
 * The app uploads the raw photo to a presigned PUT ('chat-image/<sender>/<uuid>.<ext>'). Before it becomes a message
 * the server re-encodes it: EXIF orientation applied, at most 1600 px, JPEG, NO metadata — a phone photo carries the
 * GPS position of the patient's home and the device model, which must not travel to the other side (Nghị định 13).
 * The stored message points to the clean copy only; the raw upload is never served.
 *
 * sharp is loaded on first use (same as check-in), so the API boots even if the native module is missing.
 */

export const CHAT_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 1600;

export class ChatImageUnreadableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatImageUnreadableError';
  }
}

type SharpFactory = (input?: Buffer, options?: Record<string, unknown>) => any;
let sharpFactory: SharpFactory | null = null;

async function loadSharp(): Promise<SharpFactory> {
  if (!sharpFactory) {
    const mod: any = await import('sharp');
    sharpFactory = (mod.default ?? mod) as SharpFactory;
  }
  return sharpFactory;
}

/** Decodes and re-encodes the photo; throws ChatImageUnreadableError for anything that is not a decodable image. */
export async function sanitizeChatImage(image: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  try {
    return await sharp(image, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 }) // sharp copies no EXIF / GPS / ICC unless withMetadata() is called
      .toBuffer();
  } catch (err) {
    throw new ChatImageUnreadableError((err as Error).message);
  }
}
