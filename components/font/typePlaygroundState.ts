export const DEFAULT_FONT_SIZE = 48;
export const DEFAULT_LETTER_SPACING_MODE = '%' as const;
export const DEFAULT_LETTER_SPACING_VALUE = 0;
export const DEFAULT_LINE_HEIGHT_MODE = 'auto' as const;
export const DEFAULT_LINE_HEIGHT_VALUE = 120;

export interface FacePlaygroundState {
  text: string;
  fontSize: number;
  letterSpacingMode: 'px' | '%';
  letterSpacingValue: number;
  lineHeightMode: 'auto' | '%' | 'px';
  lineHeightValue: number;
  axisValues: Record<string, number>;
}

export interface TypePlaygroundState {
  selectedFaceId: string;
  faces: Record<string, FacePlaygroundState>;
}
