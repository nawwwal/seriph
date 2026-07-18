export type DetectedFormat =
  | "TTF" | "OTF" | "WOFF" | "WOFF2" | "EOT" | "ZIP" | "GLYPHS" | "UNKNOWN";

const startsWith = (bytes: Uint8Array, signature: string): boolean => {
  const encoded = Buffer.from(signature, "ascii");
  return encoded.every((value, index) => bytes[index] === value);
};

const ascii = (bytes: Uint8Array): string => Buffer.from(bytes.subarray(0, 4096)).toString("latin1");

/** Detects formats from a bounded prefix. The caller may hash/consume the full stream separately. */
export function detectContentSignature(bytes: Uint8Array): DetectedFormat {
  const head = bytes.subarray(0, 4096);
  if (startsWith(head, "wOF2")) return "WOFF2";
  if (startsWith(head, "wOFF")) return "WOFF";
  if (startsWith(head, "OTTO")) return "OTF";
  if (head.length >= 4 && head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) return "TTF";
  if (head.length >= 4 && head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return "EOT";
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b &&
      ([0x03, 0x05, 0x07] as number[]).includes(head[2]!) &&
      ([0x04, 0x06, 0x08] as number[]).includes(head[3]!)) return "ZIP";
  const text = ascii(head);
  if (/fontMaster\s*=|glyphsVersion\s*=|\.glyphs\b/i.test(text)) return "GLYPHS";
  return "UNKNOWN";
}

export const detectFormat = detectContentSignature;
