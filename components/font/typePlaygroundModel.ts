import type { Font, VariableAxis } from '@/models/font.models';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LETTER_SPACING_MODE,
  DEFAULT_LETTER_SPACING_VALUE,
  DEFAULT_LINE_HEIGHT_MODE,
  DEFAULT_LINE_HEIGHT_VALUE,
  type FacePlaygroundState,
  type TypePlaygroundState,
} from './typePlaygroundState';
import {
  FONT_SIZE_RANGE,
  letterSpacingCss,
  lineHeightCss,
} from './typePlaygroundUnits';

export function defaultSampleText(familyName: string): string {
  return `Type here to test ${familyName}. The quick brown fox jumps over the lazy dog.`;
}

export function isItalicFace(font: Pick<Font, 'subfamily' | 'style'>): boolean {
  return /italic/i.test(`${font.subfamily} ${font.style}`);
}

export function uniqueFacesById(fonts: Font[]): Font[] {
  const seen = new Set<string>();
  return fonts.filter((font) => {
    if (!font.id || seen.has(font.id)) return false;
    seen.add(font.id);
    return true;
  });
}

export function selectDefaultFace(fonts: Font[]): Font | undefined {
  let selected: Font | undefined;
  let selectedScore = Number.POSITIVE_INFINITY;
  for (const font of uniqueFacesById(fonts)) {
    const weight = Number.isFinite(font.weight) ? font.weight : 400;
    const regularBonus = /regular/i.test(font.subfamily) ? -1 : 0;
    const score = (isItalicFace(font) ? 10_000 : 0) + Math.abs(weight - 400) + regularBonus;
    if (score < selectedScore) {
      selected = font;
      selectedScore = score;
    }
  }
  return selected;
}

export function clampFontSize(value: number): number {
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, value));
}

export function initialAxisValues(axes: VariableAxis[] | undefined): Record<string, number> {
  const values: Record<string, number> = {};
  for (const axis of axes ?? []) values[axis.tag] = axis.defaultValue;
  return values;
}

export function resetFaceState(face: Font, familyName: string): FacePlaygroundState {
  return {
    text: defaultSampleText(familyName),
    fontSize: DEFAULT_FONT_SIZE,
    letterSpacingMode: DEFAULT_LETTER_SPACING_MODE,
    letterSpacingValue: DEFAULT_LETTER_SPACING_VALUE,
    lineHeightMode: DEFAULT_LINE_HEIGHT_MODE,
    lineHeightValue: DEFAULT_LINE_HEIGHT_VALUE,
    axisValues: initialAxisValues(face.variableAxes),
  };
}

export function createPlaygroundState(fonts: Font[], familyName: string): TypePlaygroundState {
  const faces: Record<string, FacePlaygroundState> = {};
  const uniqueFaces = uniqueFacesById(fonts);
  for (const face of uniqueFaces) faces[face.id] = resetFaceState(face, familyName);
  return { selectedFaceId: selectDefaultFace(uniqueFaces)?.id ?? '', faces };
}

export function buildVariationSettings(
  axes: VariableAxis[] | undefined,
  values: Record<string, number>
): string | undefined {
  if (!axes?.length) return undefined;
  return axes.map((axis) => `'${axis.tag}' ${values[axis.tag] ?? axis.defaultValue}`).join(', ');
}

function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
  const declarations = [
    `font-family: '${cssString(familyName)}';`,
    `font-size: ${clampFontSize(state.fontSize)}px;`,
    `letter-spacing: ${letterSpacingCss(state.letterSpacingValue, state.letterSpacingMode)};`,
    `line-height: ${lineHeightCss(state.lineHeightValue, state.lineHeightMode)};`,
  ];
  const variations = buildVariationSettings(face.variableAxes, state.axisValues);
  if (variations) declarations.push(`font-variation-settings: ${variations};`);
  return declarations.join('\n');
}
