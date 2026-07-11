import type { Font, VariableAxis } from '@/models/font.models';

export {
  DEFAULT_LETTER_SPACING,
  DEFAULT_LETTER_SPACING_UNIT,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_LINE_HEIGHT_UNIT,
  convertMetricUnit,
  cssLength,
  type MetricUnit,
} from './typePlaygroundUnits';

export { buildMetricControls } from './typePlaygroundMetrics';

export const DEFAULT_FONT_SIZE = 48;
export const FONT_SIZE_RANGE = { min: 12, max: 160, step: 1 } as const;

export type MetricControl = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  units?: string[];
  onChange: (value: number, typedUnit?: string) => void;
  onUnitChange?: (unit: string) => void;
};

export function defaultSampleText(familyName: string): string {
  return `Type here to test ${familyName}. The quick brown fox jumps over the lazy dog.`;
}

export function isItalicFace(font: Pick<Font, 'subfamily' | 'style'>): boolean {
  return /italic/i.test(`${font.subfamily || ''} ${font.style || ''}`);
}

export function faceWeightLabel(font: Pick<Font, 'weight' | 'isVariable'>): string | null {
  if (font.isVariable) return null;
  return String(font.weight || 400);
}

export function sortFacesForPlayground(fonts: Font[]): Font[] {
  return [...fonts].sort((a, b) => {
    if (a.isVariable !== b.isVariable) return a.isVariable ? 1 : -1;
    if ((a.weight || 400) !== (b.weight || 400)) return (a.weight || 400) - (b.weight || 400);
    const ia = isItalicFace(a) ? 1 : 0;
    const ib = isItalicFace(b) ? 1 : 0;
    if (ia !== ib) return ia - ib;
    return (a.subfamily || '').localeCompare(b.subfamily || '');
  });
}

export function initialAxisValues(axes: VariableAxis[]): Record<string, number> {
  return axes.reduce<Record<string, number>>((acc, axis) => {
    acc[axis.tag] = axis.defaultValue;
    return acc;
  }, {});
}

export function buildVariationSettings(
  axes: VariableAxis[],
  values: Record<string, number>
): string | undefined {
  if (!axes.length) return undefined;
  return axes.map((a) => `'${a.tag}' ${values[a.tag] ?? a.defaultValue}`).join(', ');
}
