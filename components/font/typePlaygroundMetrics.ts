import {
  type MetricUnit,
  LETTER_SPACING_RANGES,
  LINE_HEIGHT_RANGES,
} from './typePlaygroundUnits';
import { FONT_SIZE_RANGE, type MetricControl } from './typePlaygroundModel';

export function buildMetricControls(args: {
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  letterSpacing: number;
  letterSpacingUnit: MetricUnit;
  onLetterSpacingChange: (value: number, typedUnit?: MetricUnit) => void;
  onLetterSpacingUnitChange: (unit: MetricUnit) => void;
  lineHeight: number;
  lineHeightUnit: MetricUnit;
  onLineHeightChange: (value: number, typedUnit?: MetricUnit) => void;
  onLineHeightUnitChange: (unit: MetricUnit) => void;
}): MetricControl[] {
  const ls = LETTER_SPACING_RANGES[args.letterSpacingUnit];
  const lh = LINE_HEIGHT_RANGES[args.lineHeightUnit];
  return [
    {
      id: 'playground-font-size',
      label: 'Font size',
      ...FONT_SIZE_RANGE,
      value: args.fontSize,
      unit: 'px',
      onChange: (v) => args.onFontSizeChange(v),
    },
    {
      id: 'playground-letter-spacing',
      label: 'Letter spacing',
      ...ls,
      value: args.letterSpacing,
      unit: args.letterSpacingUnit,
      units: ['px', '%'],
      onChange: (v, u) => args.onLetterSpacingChange(v, u as MetricUnit | undefined),
      onUnitChange: (u) => args.onLetterSpacingUnitChange(u as MetricUnit),
    },
    {
      id: 'playground-line-height',
      label: 'Line height',
      ...lh,
      value: args.lineHeight,
      unit: args.lineHeightUnit,
      units: ['px', '%'],
      onChange: (v, u) => args.onLineHeightChange(v, u as MetricUnit | undefined),
      onUnitChange: (u) => args.onLineHeightUnitChange(u as MetricUnit),
    },
  ];
}
