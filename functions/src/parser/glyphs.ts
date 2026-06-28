function hex(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Collapse a sorted set of code points into compact U+ range strings. */
function toRanges(codePoints: Set<number>): string[] {
  if (codePoints.size === 0) return [];
  const sorted = Array.from(codePoints).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;
  const push = () => ranges.push(start === end ? hex(start) : `${hex(start)}-${hex(end)}`);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) end = sorted[i];
    else { push(); start = sorted[i]; end = start; }
  }
  push();
  return ranges;
}

/** Glyph count + character-set coverage (as U+ ranges). */
export function readGlyphCoverage(font: any) {
  let glyphCount: number | undefined;
  const codePoints = new Set<number>();

  if ("glyphs" in font && font.glyphs) {
    const glyphs = font.glyphs as any;
    glyphCount = Array.isArray(glyphs) ? glyphs.length : Object.keys(glyphs).length;
    const glyphArray = Array.isArray(glyphs) ? glyphs : Object.values(glyphs);
    glyphArray.forEach((glyph: any) => {
      if (glyph && typeof glyph.unicode === "number" && glyph.unicode >= 0) codePoints.add(glyph.unicode);
      else if (glyph && Array.isArray(glyph.codePoints)) glyph.codePoints.forEach((cp: number) => { if (cp >= 0) codePoints.add(cp); });
    });
  } else if ("characterSet" in font && font.characterSet) {
    const chars = font.characterSet as any;
    glyphCount = Array.isArray(chars) ? chars.length : 0;
    if (Array.isArray(chars)) {
      chars.forEach((char: any) => {
        const code = typeof char === "number" ? char : typeof char === "string" ? char.codePointAt(0) : null;
        if (code != null && code >= 0) codePoints.add(code);
      });
    }
  }
  return { glyphCount, characterSetCoverage: toRanges(codePoints) };
}

/** Language support inferred from name-table language IDs (simplified mapping). */
export function readLanguageSupport(font: any): string[] {
  if (!("names" in font) || !font.names) return [];
  const names = font.names as any;
  const langIds = new Set<number>();
  Object.keys(names).forEach((key) => {
    Object.keys(names[key] || {}).forEach((lang) => {
      const id = parseInt(lang, 10);
      if (!isNaN(id)) langIds.add(id);
    });
  });
  return Array.from(langIds).map((id) => {
    if (id === 1033) return "en";
    if (id === 1031) return "de";
    if (id === 1036) return "fr";
    if (id === 1041) return "ja";
    return `lang_${id}`;
  });
}
