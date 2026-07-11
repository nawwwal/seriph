export type MetricUnit = 'px' | '%';

export const LETTER_SPACING_RANGES: Record<MetricUnit, { min: number; max: number; step: number }> = {
  px: { min: -20, max: 40, step: 0.5 },
  '%': { min: -20, max: 50, step: 0.5 },
};

export const LINE_HEIGHT_RANGES: Record<MetricUnit, { min: number; max: number; step: number }> = {
  px: { min: 12, max: 200, step: 1 },
  '%': { min: 80, max: 300, step: 1 },
};

export const DEFAULT_LETTER_SPACING = 0;
export const DEFAULT_LETTER_SPACING_UNIT: MetricUnit = 'px';
export const DEFAULT_LINE_HEIGHT = 120;
export const DEFAULT_LINE_HEIGHT_UNIT: MetricUnit = '%';

/** Convert px ↔ % relative to the current font size. */
export function convertMetricUnit(
  value: number,
  from: MetricUnit,
  to: MetricUnit,
  fontSizePx: number
): number {
  if (from === to) return value;
  const size = Math.max(fontSizePx, 1);
  if (from === 'px' && to === '%') return (value / size) * 100;
  return (value / 100) * size;
}

export function cssLength(value: number, unit: MetricUnit): string {
  const n = unit === 'px' && Number.isInteger(value) ? String(value) : value.toFixed(unit === '%' ? 1 : 2).replace(/\.?0+$/, '');
  return `${n}${unit}`;
}
