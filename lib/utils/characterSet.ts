import type { FontFamily } from '@/models/font.models';

export interface CharacterGroups {
  uppercase: string[];
  lowercase: string[];
  numbers: string[];
  punctuation: string[];
  spacing: string[];
  symbols: string[];
  other: string[];
}

/** Union of code points covered across all faces (printable only), parsed from U+ ranges. */
export function buildCharacterSet(family: FontFamily | null): Set<number> {
  const codePoints = new Set<number>();
  if (!family?.fonts?.length) return codePoints;

  family.fonts.forEach((font) => {
    const coverage = font.metadata?.characterSetCoverage;
    if (!Array.isArray(coverage)) return;
    coverage.forEach((range) => {
      const match = range.match(/U\+([0-9A-F]+)(?:-U\+([0-9A-F]+))?/i);
      if (!match) return;
      const start = parseInt(match[1], 16);
      const end = match[2] ? parseInt(match[2], 16) : start;
      for (let code = start; code <= end; code++) {
        if (code >= 0x20 || code === 0x09) codePoints.add(code);
      }
    });
  });
  return codePoints;
}

/** Bucket a code-point set into uppercase/lowercase/numbers/punctuation/symbols/other. */
export function groupCharacters(characterSet: Set<number>): CharacterGroups {
  const groups: CharacterGroups = {
    uppercase: [],
    lowercase: [],
    numbers: [],
    punctuation: [],
    spacing: [],
    symbols: [],
    other: [],
  };

  Array.from(characterSet)
    .sort((a, b) => a - b)
    .forEach((codePoint) => {
      try {
        const char = String.fromCodePoint(codePoint);
        const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
        const isLower = char === char.toLowerCase() && char !== char.toUpperCase();
        if (isUpper || /[A-Z]/.test(char)) groups.uppercase.push(char);
        else if (isLower || /[a-z]/.test(char)) groups.lowercase.push(char);
        else if (/[0-9]/.test(char)) groups.numbers.push(char);
        else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(char)) groups.punctuation.push(char);
        else if (char.trim() === '') groups.spacing.push(char);
        else if (/[^\w\s]/.test(char)) groups.symbols.push(char);
        else groups.other.push(char);
      } catch (e) {
        console.warn(`Invalid code point: ${codePoint}`, e);
      }
    });

  (Object.keys(groups) as (keyof CharacterGroups)[]).forEach((key) => {
    groups[key] = [...new Set(groups[key])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  });
  return groups;
}
