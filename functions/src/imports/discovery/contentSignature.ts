export type DetectedFormat =
  | "TTF" | "OTF" | "WOFF" | "WOFF2" | "EOT" | "ZIP" | "GLYPHS" | "UNKNOWN";

const startsWith = (bytes: Uint8Array, signature: string): boolean => {
  const encoded = Buffer.from(signature, "ascii");
  return encoded.every((value, index) => bytes[index] === value);
};

const ascii = (bytes: Uint8Array): string => Buffer.from(bytes.subarray(0, 4096)).toString("latin1");

const uint16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8);
const uint32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)) >>> 0;

const eotVersions = new Set([0x00010000, 0x00020001, 0x00020002]);

function validEotHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 84) return false;
  const eotSize = uint32(bytes, 0);
  const fontDataSize = uint32(bytes, 4);
  const version = uint32(bytes, 8);
  if (!eotVersions.has(version) || eotSize < 96 || fontDataSize === 0 ||
      eotSize < 96 + fontDataSize || uint16(bytes, 34) !== 0x504c) return false;
  if ([64, 68, 72, 76].some((offset) => uint32(bytes, offset) !== 0) || uint16(bytes, 80) !== 0) return false;
  if (eotSize > bytes.length) return true;
  if (eotSize !== bytes.length) return false;

  let offset = 82;
  const readPaddedString = (): boolean => {
    if (offset + 2 > eotSize) return false;
    const length = uint16(bytes, offset);
    offset += 2 + length;
    if (offset + 2 > eotSize) return false;
    offset += 2;
    return true;
  };
  if (!readPaddedString() || !readPaddedString() || !readPaddedString()) return false;
  if (offset + 2 > eotSize) return false;
  const fullNameSize = uint16(bytes, offset);
  offset += 2 + fullNameSize;
  if (offset > eotSize) return false;
  if (version !== 0x00010000) {
    if (offset + 2 > eotSize) return false;
    const rootStringSize = uint16(bytes, offset);
    offset += 2 + rootStringSize;
    if (offset > eotSize) return false;
  }
  if (version === 0x00020002) {
    if (offset + 12 > eotSize) return false;
    const signatureSize = uint16(bytes, offset + 10);
    offset += 12 + signatureSize;
    if (offset + 8 > eotSize) return false;
    const eudcFontSize = uint32(bytes, offset + 4);
    offset += 8 + eudcFontSize;
    if (offset > eotSize) return false;
  }
  return offset + fontDataSize === eotSize;
}

/** Detects formats from a bounded prefix. The caller may hash/consume the full stream separately. */
export function detectContentSignature(bytes: Uint8Array): DetectedFormat {
  const head = bytes.subarray(0, 4096);
  if (startsWith(head, "wOF2")) return "WOFF2";
  if (startsWith(head, "wOFF")) return "WOFF";
  if (startsWith(head, "OTTO")) return "OTF";
  if (head.length >= 4 && head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) return "TTF";
  if (validEotHeader(head)) return "EOT";
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b &&
      ([0x03, 0x05, 0x07] as number[]).includes(head[2]!) &&
      ([0x04, 0x06, 0x08] as number[]).includes(head[3]!)) return "ZIP";
  const text = ascii(head);
  if (/fontMaster\s*=|glyphsVersion\s*=|\.glyphs\b/i.test(text)) return "GLYPHS";
  return "UNKNOWN";
}

export const detectFormat = detectContentSignature;
