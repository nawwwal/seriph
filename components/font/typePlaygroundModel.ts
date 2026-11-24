import type { Font, VariableAxis } from '@/models/font.models';
import { quoteCssFontFamily } from '@/lib/utils/cssFont';
import { isItalicFace, type FacePlaygroundState } from './typePlaygroundState';
import {
  FONT_SIZE_RANGE,
  letterSpacingCss,
  lineHeightCss,
} from './typePlaygroundUnits';

export {
  createPlaygroundState, defaultSampleText, initialAxisValues, isItalicFace,
  reconcilePlaygroundState, resetFaceState, selectDefaultFace, uniqueFacesById,
} from './typePlaygroundState';
export { buildPlaygroundFaceOptions, buildPlaygroundFaceRegistration } from './typePlaygroundStyles';

export function clampFontSize(value: number): number {
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, value));
}

export function faceWeightLabel(font: Pick<Font, 'weight' | 'isVariable'>): string | null {
  return font.isVariable ? null : String(font.weight || 400);
}

export function sortFacesForPlayground(fonts: Font[]): Font[] {
  return [...fonts].sort((a, b) => {
    if (a.isVariable !== b.isVariable) return a.isVariable ? -1 : 1;
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.subfamily.localeCompare(b.subfamily);
  });
}

export function buildVariationSettings(
  axes: VariableAxis[] | undefined,
  values: Record<string, number>
): string | undefined {
  if (!axes?.length) return undefined;
  return axes.map((axis) => `'${axis.tag}' ${values[axis.tag] ?? axis.defaultValue}`).join(', ');
}

export function serializePlaygroundCss({
  familyName,
  face,
  state,
}: {
  familyName: string;
  face: Font;
  state: FacePlaygroundState;
}): string {
  const axes = face.isVariable ? face.variableAxes : undefined;
  const weight = axes?.length ? Math.round(state.axisValues.wght ?? face.weight ?? 400) : face.weight || 400;
  const dynamicItal = Boolean(axes?.some((axis) => axis.tag === 'ital') && (state.axisValues.ital ?? 0) >= 0.5);
  const declarations = [
    `font-family: ${quoteCssFontFamily(familyName)};`,
    `font-weight: ${weight};`,
    `font-style: ${dynamicItal || isItalicFace(face) ? 'italic' : 'normal'};`,
    `font-size: ${clampFontSize(state.fontSize)}px;`,
    `letter-spacing: ${letterSpacingCss(state.letterSpacingValue, state.letterSpacingMode)};`,
    `line-height: ${lineHeightCss(state.lineHeightValue, state.lineHeightMode)};`,
  ];
  const variations = buildVariationSettings(axes, state.axisValues);
  if (variations) declarations.push(`font-variation-settings: ${variations};`);
  return declarations.join('\n');
}
