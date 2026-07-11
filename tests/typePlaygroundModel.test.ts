import { describe, expect, it } from 'vitest';
import type { Font } from '@/models/font.models';
import { clampFontSize, createPlaygroundState, reconcilePlaygroundState, resetFaceState, selectDefaultFace,
  serializePlaygroundCss, uniqueFacesById } from '@/components/font/typePlaygroundModel';
import { convertLetterSpacing } from '@/components/font/typePlaygroundUnits';

function font(overrides: Partial<Font> = {}): Font {
  return {
    id: 'regular',
    filename: 'Regular.woff2',
    format: 'WOFF2',
    subfamily: 'Regular',
    weight: 400,
    style: 'Regular',
    isVariable: false,
    fileSize: 1_024,
    metadata: {},
    ...overrides,
  };
}

describe('type playground model', () => {
  it('selects the closest upright face to Regular 400', () => {
    const faces = [
      font({ id: 'italic-400', subfamily: 'Italic', style: 'Italic' }),
      font({ id: 'upright-500', subfamily: 'Medium', style: 'Medium', weight: 500 }),
      font({ id: 'upright-400' }),
    ];

    expect(selectDefaultFace(faces)?.id).toBe('upright-400');
    expect(selectDefaultFace(faces.slice(0, 2))?.id).toBe('upright-500');
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

  it('converts px tracking to and from em-relative percent-like values', () => {
    expect(convertLetterSpacing(4, 'px', '%', 40)).toBeCloseTo(0.1);
    expect(convertLetterSpacing(0.1, '%', 'px', 40)).toBeCloseTo(4);
  });

  it('stores Auto, percent, and px line-height modes per face', () => {
    const state = createPlaygroundState([font()], 'Inter').faces.regular;

    expect(state).toMatchObject({ lineHeightMode: 'auto', lineHeightValue: 120,
      letterSpacingMode: '%', letterSpacingValue: 0, fontSize: 48 });
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
      fontSize: 64,
      letterSpacingMode: '%' as const,
      letterSpacingValue: 0.08,
      lineHeightMode: '%' as const,
      lineHeightValue: 135,
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
      state: { ...state, lineHeightMode: 'auto', axisValues: {} },
    })).toContain('line-height: normal;');
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
    expect(refreshed.faces.bold).toMatchObject({ fontSize: 48, lineHeightMode: 'auto' });
  });
});
