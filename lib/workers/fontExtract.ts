import * as opentype from 'opentype.js';

/** Extract family/subfamily/postScript names, normalizing opentype.js v2 shapes. */
export function extractNameTable(font: opentype.Font): {
  family?: string;
  subfamily?: string;
  postScriptName?: string;
} {
  // opentype.js v2 exposes localized name records ({ en: "..." }) instead of
  // plain strings, and drops the preferred* aliases. Normalize both shapes.
  const names = font.names as any;
  const pick = (n: unknown): string | undefined => {
    if (!n) return undefined;
    if (typeof n === 'string') return n;
    return (n as any).en ?? Object.values(n as Record<string, string>)[0];
  };
  return {
    family: pick(names.preferredFamily) || pick(names.fontFamily) || pick(names.fontSubfamily),
    subfamily: pick(names.preferredSubfamily) || pick(names.fontSubfamily),
    postScriptName: pick(names.postScriptName),
  };
}

/** OS/2 weight class. */
export function extractOS2Metrics(font: opentype.Font): { weightClass?: number } {
  const os2 = (font as any).tables?.os2;
  return os2 ? { weightClass: os2.usWeightClass } : {};
}

/** Detect a variable font and its fvar axes. */
export function detectVariableFont(font: opentype.Font): {
  isVariable: boolean;
  axes?: Array<{ tag: string; min: number; max: number; default: number }>;
} {
  const fvar = (font as any).tables?.fvar;
  if (!fvar || !fvar.axes) return { isVariable: false };
  return {
    isVariable: true,
    axes: fvar.axes.map((axis: any) => ({ tag: axis.tag, min: axis.min, max: axis.max, default: axis.default })),
  };
}
