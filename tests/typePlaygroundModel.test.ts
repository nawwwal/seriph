import { describe, expect, it } from 'vitest';
import type { Font } from '@/models/font.models';
import { clampFontSize, createPlaygroundState, reconcilePlaygroundState, resetFaceState, selectDefaultFace,
  serializePlaygroundCss, uniqueFacesById } from '@/components/font/typePlaygroundModel';
import { convertLetterSpacing, convertLineHeight } from '@/components/font/typePlaygroundUnits';

function font(overrides: Partial<Font> = {}): Font {
  return {
    id: 'regular', filename: 'Regular.woff2', format: 'WOFF2',
    subfamily: 'Regular', weight: 400, style: 'Regular',
    isVariable: false, fileSize: 1_024, metadata: {},
    ...overrides,
  };
}

describe('type playground model', () => {
  it('selects the closest upright face to Regular 400', () => {
    const faces = [
      font({ id: 'italic-400', subfamily: 'Italic', style: 'Italic' }),
      font({ id: 'oblique-400', subfamily: 'Regular Oblique' }),
      font({ id: 'metadata-400', metadata: { italic: true } }),
      font({ id: 'upright-500', subfamily: 'Medium', style: 'Medium', weight: 500 }),
      font({ id: 'upright-400' }),
    ];

    expect(selectDefaultFace(faces)?.id).toBe('upright-400');
    expect(selectDefaultFace(faces.slice(0, 4))?.id).toBe('upright-500');
  });

  it('keeps one selector option and state entry per face ID', () => {
    const faces = [font(), font({ subfamily: 'Duplicate Regular' }), font({ id: 'bold', weight: 700 })];

    expect(uniqueFacesById(faces).map((face) => face.id)).toEqual(['regular', 'bold']);
    expect(Object.keys(createPlaygroundState(faces, 'Inter').faces)).toEqual(['regular', 'bold']);
  });

  it('clamps font size to the 12px through 200px contract', () => {
    expect(clampFontSize(4)).toBe(12);
    expect(clampFontSize(96)).toBe(96);
    expect(clampFontSize(240)).toBe(200);
  });

  it('converts px tracking to explicit em values and normalizes the target range', () => {
    expect(convertLetterSpacing(4, 'px', 'em', 40)).toBeCloseTo(0.1);
    expect(convertLetterSpacing(0.1, 'em', 'px', 40)).toBeCloseTo(4);
    expect(convertLetterSpacing(40, 'px', 'em', 12)).toBe(0.5);
    expect(convertLetterSpacing(0.123, 'em', 'em', 40)).toBe(0.125);
  });

  it('converts line height and clamps it to the target mode range', () => {
    expect(convertLineHeight(300, '%', 'px', 48)).toBe(144);
    expect(convertLineHeight(200, 'px', '%', 48)).toBe(300);
    expect(convertLineHeight(100, '%', 'px', 48)).toBe(48);
  });

  it('defaults line height to 100% (no auto mode)', () => {
    const state = createPlaygroundState([font()], 'Inter').faces.regular;

    expect(state).toMatchObject({ lineHeightMode: '%', lineHeightValue: 100,
      letterSpacingMode: 'em', letterSpacingValue: 0, fontSize: 80 });
  });

  it('serializes only playground CSS declarations with valid relative tracking', () => {
    const face = font({
      id: 'variable',
      isVariable: true,
      variableAxes: [
        { tag: 'wght', name: 'Weight', minValue: 100, maxValue: 900, defaultValue: 400 },
      ],
    });
    const state = {
      ...createPlaygroundState([face], "Director's Cut").faces.variable,
      fontSize: 64, letterSpacingMode: 'em' as const, letterSpacingValue: 0.08,
      lineHeightMode: '%' as const, lineHeightValue: 135,
      axisValues: { wght: 625 },
    };

    expect(serializePlaygroundCss({ familyName: "Director's Cut", face, state })).toBe(
      "font-family: 'Director\\'s Cut';\n" +
      'font-size: 64px;\n' +
      'letter-spacing: 0.08em;\n' +
      'line-height: 135%;\n' +
      "font-variation-settings: 'wght' 625;"
    );
    expect(serializePlaygroundCss({
      familyName: 'Inter',
      face: font(),
      state: { ...state, lineHeightMode: '%', lineHeightValue: 100, axisValues: {} },
    })).toContain('line-height: 100%;');
  });

  it('resets text, metrics, and every axis to declared defaults', () => {
    const face = font({
      isVariable: true,
      variableAxes: [
        { tag: 'wght', name: 'Weight', minValue: 100, maxValue: 900, defaultValue: 450 },
        { tag: 'wdth', name: 'Width', minValue: 75, maxValue: 125, defaultValue: 100 },
      ],
    });

    expect(resetFaceState(face, 'Inter')).toEqual(createPlaygroundState([face], 'Inter').faces.regular);
    expect(resetFaceState(face, 'Inter').axisValues).toEqual({ wght: 450, wdth: 100 });
  });

  it('retains selected per-face values while reconciling refreshed family data', () => {
    const regular = font();
    const prior = createPlaygroundState([regular], 'Inter');
    prior.faces.regular = { ...prior.faces.regular, text: 'Keep me', fontSize: 72 };
    const refreshed = reconcilePlaygroundState(prior, [regular, font({ id: 'bold', weight: 700 })], 'Inter');

    expect(refreshed.selectedFaceId).toBe('regular');
    expect(refreshed.faces.regular).toMatchObject({ text: 'Keep me', fontSize: 72 });
    expect(refreshed.faces.bold).toMatchObject({ fontSize: 80, lineHeightMode: '%', lineHeightValue: 100 });
  });
});
