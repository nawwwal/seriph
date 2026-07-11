import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LETTER_SPACING,
  DEFAULT_LETTER_SPACING_UNIT,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_LINE_HEIGHT_UNIT,
  convertMetricUnit,
  type MetricUnit,
} from './typePlaygroundModel';
import { LETTER_SPACING_RANGES, LINE_HEIGHT_RANGES } from './typePlaygroundUnits';

export function clampMetric(value: number, unit: MetricUnit, kind: 'spacing' | 'leading') {
  const range = kind === 'spacing' ? LETTER_SPACING_RANGES[unit] : LINE_HEIGHT_RANGES[unit];
  return Math.min(range.max, Math.max(range.min, value));
}

export function switchMetricUnit(
  value: number,
  from: MetricUnit,
  to: MetricUnit,
  fontSize: number,
  kind: 'spacing' | 'leading'
) {
  return clampMetric(convertMetricUnit(value, from, to, fontSize), to, kind);
}

/** Apply typed value; if unit was typed (48% / 48px), use it as-is without converting. */
export function applyTypedMetric(
  value: number,
  typedUnit: MetricUnit | undefined,
  currentUnit: MetricUnit,
  kind: 'spacing' | 'leading'
): { value: number; unit: MetricUnit } {
  const unit = typedUnit ?? currentUnit;
  return { value: clampMetric(value, unit, kind), unit };
}

export const PLAYGROUND_DEFAULTS = {
  fontSize: DEFAULT_FONT_SIZE as number,
  letterSpacing: DEFAULT_LETTER_SPACING as number,
  letterSpacingUnit: DEFAULT_LETTER_SPACING_UNIT as MetricUnit,
  lineHeight: DEFAULT_LINE_HEIGHT as number,
  lineHeightUnit: DEFAULT_LINE_HEIGHT_UNIT as MetricUnit,
};
