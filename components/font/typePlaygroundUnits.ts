export type LetterSpacingMode = 'px' | 'em';
export type LineHeightMode = '%' | 'px';

export const FONT_SIZE_RANGE = { min: 12, max: 200, step: 1 } as const;
export const LETTER_SPACING_RANGES = {
  px: { min: -20, max: 40, step: 0.5 },
  em: { min: -0.2, max: 0.5, step: 0.005 },
} as const;
export const LINE_HEIGHT_RANGES = {
  '%': { min: 80, max: 300, step: 1 },
  px: { min: 12, max: 200, step: 1 },
} as const;

export function convertLetterSpacing(
  value: number,
  from: LetterSpacingMode,
  to: LetterSpacingMode,
  fontSize: number
): number {
  const safeFontSize = Math.max(fontSize, 1);
  const converted = from === to ? value : from === 'px' ? value / safeFontSize : value * safeFontSize;
  return normalizeRangeValue(converted, LETTER_SPACING_RANGES[to]);
}

function normalizeRangeValue(
  value: number,
  range: { min: number; max: number; step: number }
): number {
  const snapped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return Math.min(range.max, Math.max(range.min, Number(snapped.toFixed(6))));
}

export function convertLineHeight(
  value: number,
  from: LineHeightMode,
  to: LineHeightMode,
  fontSize: number
): number {
  if (from === to) return normalizeRangeValue(value, LINE_HEIGHT_RANGES[to]);
  const safeFontSize = Math.max(fontSize, 1);
  const ratio = from === '%' ? value / 100 : value / safeFontSize;
  const converted = to === '%' ? ratio * 100 : ratio * safeFontSize;
  return normalizeRangeValue(converted, LINE_HEIGHT_RANGES[to]);
}

export function formatCssNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function letterSpacingCss(value: number, mode: LetterSpacingMode): string {
  return `${formatCssNumber(value)}${mode}`;
}

export function lineHeightCss(value: number, mode: LineHeightMode): string {
  return `${formatCssNumber(value)}${mode}`;
}
