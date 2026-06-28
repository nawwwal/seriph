/**
 * Font transcoding for web serving.
 *
 * Produces an optimized woff2 (the artifact the CDN serves) from an uploaded
 * face, while the original file is kept for download. Uses `wawoff2` (Google's
 * woff2 encoder compiled to wasm) so it runs in any Node runtime including gen2
 * Cloud Functions — no native build step.
 *
 * woff2 input must be sfnt (TTF/OTF). WOFF must be decompressed first; an
 * already-woff2 upload is passed through unchanged.
 */
import * as wawoff2 from 'wawoff2';

export type FontFormat = 'TTF' | 'OTF' | 'WOFF' | 'WOFF2' | 'EOT';

/** True for sfnt containers that woff2 can compress directly. */
function isSfnt(format: FontFormat): boolean {
  return format === 'TTF' || format === 'OTF';
}

/**
 * Convert an uploaded font buffer to woff2.
 * @returns the woff2 bytes, or null if the input can't be transcoded (e.g. EOT).
 */
export async function toWoff2(input: Buffer, format: FontFormat): Promise<Buffer | null> {
  try {
    if (format === 'WOFF2') return input; // already optimal
    if (isSfnt(format)) {
      const out = await wawoff2.compress(input);
      return Buffer.from(out);
    }
    if (format === 'WOFF') {
      // wawoff2 only compresses sfnt; WOFF1 must be inflated to sfnt first.
      // Defer WOFF1 support to a follow-up; signal "no woff2" so callers fall
      // back to serving the original.
      return null;
    }
    return null; // EOT and unknowns
  } catch {
    return null;
  }
}
