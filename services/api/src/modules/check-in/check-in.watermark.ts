/**
 * check-in — stamps the live selfie (BE-2 · Phase 4).
 * SRS RISK-05 / NFR-SEC-01 (CT-21): "đóng dấu Server Timestamp + tọa độ lên ảnh" — the server burns its own time and
 * the GPS position into the pixels, so the photo the family sees (and the dispute evidence) carries the stamp even
 * when it is copied out of the app.
 *
 * The photo is re-encoded as JPEG: EXIF orientation applied, then all metadata dropped (no device GPS/serial leaks),
 * scaled down to at most 1080 × 1440 (enough to recognise a face, ~150–300 KB). A file that cannot be decoded as an
 * image is refused (SelfieUnreadableError).
 *
 * sharp is loaded on first use, so the API still boots if the native module is missing; check-in then fails clearly.
 */

export class SelfieUnreadableError extends Error {
  constructor(reason: string) {
    super(`The selfie cannot be read as an image: ${reason}`);
    this.name = 'SelfieUnreadableError';
  }
}

const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1440;

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Semi-transparent band at the bottom with one text line per entry. */
export function stampSvg(width: number, lines: string[]): { svg: Buffer; height: number } {
  const fontSize = Math.max(14, Math.round(width / 32));
  const lineHeight = Math.round(fontSize * 1.35);
  const pad = Math.round(fontSize * 0.6);
  const height = pad * 2 + lineHeight * lines.length;
  const text = lines
    .map(
      (l, i) =>
        `<text x="${pad}" y="${pad + lineHeight * (i + 1) - Math.round(lineHeight * 0.3)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${i === 0 ? 700 : 400}" fill="#ffffff">${escapeXml(l)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000000" fill-opacity="0.6"/>${text}</svg>`;
  return { svg: Buffer.from(svg), height };
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

/** Returns the stamped JPEG. Throws SelfieUnreadableError when the bytes are not a decodable image. */
export async function stampSelfie(image: Buffer, lines: string[]): Promise<Buffer> {
  const sharp = await loadSharp();
  let base: { data: Buffer; info: { width: number; height: number } };
  try {
    base = await sharp(image, { failOn: 'error' })
      .rotate() // apply the EXIF orientation of the camera
      .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    throw new SelfieUnreadableError((err as Error).message);
  }
  const { svg, height } = stampSvg(base.info.width, lines);
  return sharp(base.data)
    .composite([{ input: svg, left: 0, top: Math.max(0, base.info.height - height) }])
    .jpeg({ quality: 85 }) // metadata is not copied: the stamp is the only location on the file
    .toBuffer();
}
