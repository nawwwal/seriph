import type { Font, VariableAxis } from '@/models/font.models';

export const DEFAULT_FONT_SIZE = 48;
export const DEFAULT_LETTER_SPACING_MODE = 'em' as const;
export const DEFAULT_LETTER_SPACING_VALUE = 0;
export const DEFAULT_LINE_HEIGHT_MODE = 'auto' as const;
export const DEFAULT_LINE_HEIGHT_VALUE = 120;

export interface FacePlaygroundState {
  text: string;
  fontSize: number;
  letterSpacingMode: 'px' | 'em';
  letterSpacingValue: number;
  lineHeightMode: 'auto' | '%' | 'px';
  lineHeightValue: number;
  axisValues: Record<string, number>;
}

export interface TypePlaygroundState {
  selectedFaceId: string;
  faces: Record<string, FacePlaygroundState>;
}

export function defaultSampleText(familyName: string): string {
  return `Type here to test ${familyName}. The quick brown fox jumps over the lazy dog.`;
}

type FacePosture = Pick<Font, 'subfamily' | 'style' | 'metadata'> & { italic?: boolean };

export function isItalicFace(font: FacePosture): boolean {
  const metadata = font.metadata;
  const canonicalStyle = [metadata.styleName, metadata.fontStyle]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return font.italic === true || metadata.italic === true || metadata.isItalic === true
    || /italic|oblique/i.test(`${font.subfamily} ${font.style} ${canonicalStyle}`);
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
    const score = (isItalicFace(font) ? 10_000 : 0)
      + Math.abs(weight - 400) - (/regular/i.test(font.subfamily) ? 1 : 0);
    if (score < selectedScore) {
      selected = font;
      selectedScore = score;
    }
  }
  return selected;
}

export function initialAxisValues(axes: VariableAxis[] | undefined): Record<string, number> {
  const values: Record<string, number> = {};
  for (const axis of axes ?? []) values[axis.tag] = axis.defaultValue;
  return values;
}

export function resetFaceState(face: Font, familyName: string): FacePlaygroundState {
  return {
    text: defaultSampleText(familyName), fontSize: DEFAULT_FONT_SIZE,
    letterSpacingMode: DEFAULT_LETTER_SPACING_MODE,
    letterSpacingValue: DEFAULT_LETTER_SPACING_VALUE,
    lineHeightMode: DEFAULT_LINE_HEIGHT_MODE, lineHeightValue: DEFAULT_LINE_HEIGHT_VALUE,
    axisValues: initialAxisValues(face.variableAxes),
  };
}

export function createPlaygroundState(fonts: Font[], familyName: string): TypePlaygroundState {
  const faces: Record<string, FacePlaygroundState> = {};
  const uniqueFaces = uniqueFacesById(fonts);
  for (const face of uniqueFaces) faces[face.id] = resetFaceState(face, familyName);
  return { selectedFaceId: selectDefaultFace(uniqueFaces)?.id ?? '', faces };
}

export function reconcilePlaygroundState(
  previous: TypePlaygroundState,
  fonts: Font[],
  familyName: string
): TypePlaygroundState {
  const next = createPlaygroundState(fonts, familyName);
  for (const face of uniqueFacesById(fonts)) {
    const prior = previous.faces[face.id];
    if (!prior) continue;
    next.faces[face.id] = {
      ...prior,
      axisValues: { ...initialAxisValues(face.variableAxes), ...prior.axisValues },
    };
  }
  if (next.faces[previous.selectedFaceId]) next.selectedFaceId = previous.selectedFaceId;
  return next;
}
