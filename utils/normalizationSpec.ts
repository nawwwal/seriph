/**
 * Normalization Spec v1.0.0
 * 
 * Client-side font family name normalization for preview grouping.
 * This spec mirrors the server's canonical normalization algorithm.
 * 
 * Rules:
 * 1. Unicode normalize (NFC) and casefold
 * 2. Trim whitespace/punctuation, collapse repeats
 * 3. Remove trademark symbols (™ ® ©)
 * 4. Strip style tokens from tail: "Regular, Italic, Bold, Black, Condensed, Extended, Narrow, Wide" and numeric weights
 * 5. Keep design-line qualifiers as separate field: "Text, Display, Caption, Headline, UI, Pro, Nova, Sans, Serif, Mono"
 * 6. Drop foundry suffixes: parentheses or trailing "Std/Office/Web"
 * 7. Prefer nameID 16 over 1; fall back to 1 if 16 missing; use English fallback if localized only
 */

export const NORMALIZATION_SPEC_VERSION = '1.0.0';

/**
 * Style tokens to strip from family name tail
 */
const STYLE_TOKENS = [
  'regular',
  'italic',
  'bold',
  'black',
  'condensed',
  'extended',
  'narrow',
  'wide',
  'thin',
  'extralight',
  'light',
  'medium',
  'semibold',
  'extrabold',
  'ultra',
  'heavy',
];

/**
 * Numeric weight patterns to strip
 */
const NUMERIC_WEIGHT_PATTERN = /\b\d{3,4}\b/g;

/**
 * Design-line qualifiers (kept separate, not stripped)
 */
export const DESIGN_LINE_QUALIFIERS = [
  'text',
  'display',
  'caption',
  'headline',
  'ui',
  'pro',
  'nova',
  'sans',
  'serif',
  'mono',
];

/**
 * Foundry suffix patterns
 */
const FOUNDRY_SUFFIXES = [
  /\s+by\s+[^)]+$/i,
  /\s+std$/i,
  /\s+office$/i,
  /\s+web$/i,
  /\s*\([^)]*\)$/g, // Remove parenthetical suffixes
];

/**
 * Trademark symbols to remove
 */
const TRADEMARK_SYMBOLS = /[™®©]/g;

/**
 * Normalize a font family name according to spec v1.0.0
 * 
 * @param name - Raw family name from font file
 * @returns Normalized family name for grouping
 */
export function normalizeFamilyName(name: string): string {
  if (!name) return 'unknown';

  // Step 1: Unicode normalize (NFC) and casefold
  let normalized = name
    .normalize('NFC')
    .toLowerCase();

  // Step 2: Remove trademark symbols
  normalized = normalized.replace(TRADEMARK_SYMBOLS, '');

  // Step 3: Trim whitespace and collapse repeats
  normalized = normalized
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens
    .replace(/-+/g, '-')
    .replace(/\s+/g, '-'); // Convert spaces to hyphens for consistency

  // Step 4: Remove foundry suffixes
  for (const pattern of FOUNDRY_SUFFIXES) {
    normalized = normalized.replace(pattern, '');
  }
  normalized = normalized.trim();

  // Step 5: Strip numeric weights
  normalized = normalized.replace(NUMERIC_WEIGHT_PATTERN, '');

  // Step 6: Strip style tokens from tail
  const parts = normalized.split('-');
  const filteredParts: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    // Check if this is a style token
    const isStyleToken = STYLE_TOKENS.some(token => 
      part === token || part.startsWith(token) || part.endsWith(token)
    );
    
    // Keep non-style tokens, but skip if it's at the end and matches a style token
    if (!isStyleToken || i < parts.length - 1) {
      filteredParts.push(part);
    }
  }

  normalized = filteredParts.join('-');

  // Step 7: Final cleanup
  normalized = normalized
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();

  return normalized || 'unknown';
}

/**
 * Extract design-line qualifier from family name
 * 
 * @param name - Raw family name
 * @returns Design-line qualifier if found, null otherwise
 */
export function extractDesignLineQualifier(name: string): string | null {
  if (!name) return null;

  const lowerName = name.toLowerCase();
  for (const qualifier of DESIGN_LINE_QUALIFIERS) {
    if (lowerName.includes(qualifier)) {
      return qualifier;
    }
  }
  return null;
}

/**
 * Compare two normalization spec versions
 * 
 * @param version1 - First version (e.g., "1.0.0")
 * @param version2 - Second version (e.g., "1.1.0")
 * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareSpecVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part < v2Part) return -1;
    if (v1Part > v2Part) return 1;
  }

  return 0;
}

/**
 * Check if a spec version mismatch requires a warning
 * 
 * @param clientVersion - Client's spec version
 * @param serverVersion - Server's spec version
 * @returns true if mismatch should show warning
 */
export function shouldWarnAboutSpecMismatch(
  clientVersion: string,
  serverVersion: string
): boolean {
  const comparison = compareSpecVersions(clientVersion, serverVersion);
  
  // Extract major version numbers
  const clientMajor = parseInt(clientVersion.split('.')[0] || '0', 10);
  const serverMajor = parseInt(serverVersion.split('.')[0] || '0', 10);
  
  // Warn if client is outdated (client < server) or major version differs
  return comparison < 0 || clientMajor !== serverMajor;
}

