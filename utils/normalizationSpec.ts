/**
 * Normalization Spec v1.0.0 — client-side family-name normalization for preview
 * grouping. Mirrors the server's canonical algorithm: NFC + casefold, strip
 * trademark symbols, foundry suffixes, numeric weights, and tail style tokens.
 */

export const NORMALIZATION_SPEC_VERSION = "1.0.0";

const STYLE_TOKENS = [
  "regular", "italic", "bold", "black", "condensed", "extended", "narrow", "wide",
  "thin", "extralight", "light", "medium", "semibold", "extrabold", "ultra", "heavy",
  "hairline", "variable", "vf",
];

const NUMERIC_WEIGHT_PATTERN = /\b\d{3,4}\b/g;
const TRADEMARK_SYMBOLS = /[™®©]/g;
const FOUNDRY_SUFFIXES = [
  /\s+by\s+[^)]+$/i,
  /\s+std$/i,
  /\s+office$/i,
  /\s+web$/i,
  /\s*\([^)]*\)$/g,
];

/** Normalize a font family name according to spec v1.0.0 (for grouping). */
export function normalizeFamilyName(name: string): string {
  if (!name) return "unknown";

  let normalized = name.normalize("NFC").toLowerCase().replace(TRADEMARK_SYMBOLS, "");
  normalized = normalized
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .replace(/-+/g, "-")
    .replace(/\s+/g, "-");

  for (const pattern of FOUNDRY_SUFFIXES) normalized = normalized.replace(pattern, "");
  normalized = normalized.trim().replace(NUMERIC_WEIGHT_PATTERN, "");

  // Strip style tokens from the tail only (exact match avoids "ultracompact" etc.).
  const parts = normalized.split("-");
  const kept: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const isStyleToken = STYLE_TOKENS.includes(part);
    if (!isStyleToken || i < parts.length - 1) kept.push(part);
  }

  normalized = kept.join("-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").trim();
  return normalized || "unknown";
}

/** Semver compare: -1 if a<b, 0 if equal, 1 if a>b. */
export function compareSpecVersions(version1: string, version2: string): number {
  const a = version1.split(".").map(Number);
  const b = version2.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Warn when the client spec is older than, or a different major from, the server's. */
export function shouldWarnAboutSpecMismatch(clientVersion: string, serverVersion: string): boolean {
  const comparison = compareSpecVersions(clientVersion, serverVersion);
  const clientMajor = parseInt(clientVersion.split(".")[0] || "0", 10);
  const serverMajor = parseInt(serverVersion.split(".")[0] || "0", 10);
  return comparison < 0 || clientMajor !== serverMajor;
}
