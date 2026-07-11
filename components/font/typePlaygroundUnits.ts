export type LetterSpacingMode = 'px' | '%';
export type LineHeightMode = 'auto' | '%' | 'px';

export const FONT_SIZE_RANGE = { min: 12, max: 200, step: 1 } as const;
export const LETTER_SPACING_RANGES = {
  px: { min: -20, max: 40, step: 0.5 },
  '%': { min: -20, max: 50, step: 0.5 },
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
  if (from === to) return value;
  const safeFontSize = Math.max(fontSize, 1);
  return from === 'px' ? value / safeFontSize : value * safeFontSize;
}

export function letterSpacingDisplayValue(value: number, mode: LetterSpacingMode): number {
  return mode === '%' ? value * 100 : value;
}

export function letterSpacingStoredValue(value: number, mode: LetterSpacingMode): number {
  return mode === '%' ? value / 100 : value;
}

export function formatCssNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function letterSpacingCss(value: number, mode: LetterSpacingMode): string {
  return `${formatCssNumber(value)}${mode === '%' ? 'em' : 'px'}`;
}

export function lineHeightCss(value: number, mode: LineHeightMode): string {
  if (mode === 'auto') return 'normal';
  return `${formatCssNumber(value)}${mode}`;
}
