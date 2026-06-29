import type { FontFamilyDoc, FontFace } from '../../src/models/catalog.models';

export function face(partial: Partial<FontFace> & { id: string }): FontFace {
  return {
    styleName: 'Regular',
    weight: 400,
    weightName: 'Regular',
    italic: false,
    isVariable: false,
    format: 'TTF',
    fileSize: 1000,
    filename: 'X.woff2',
    woff2: { storagePath: 's/x/1/X.woff2', url: 'https://cdn.test/s/x/1/X.woff2' },
    original: { storagePath: 'd/x/1/X.ttf', url: 'https://cdn.test/d/x/1/X.ttf' },
    ...partial,
  };
}

export const interVariable: FontFamilyDoc = {
  id: 'inter',
  slug: 'inter',
  name: 'Inter',
  fileBase: 'Inter',
  category: 'SANS_SERIF',
  status: 'enriched',
  version: 1,
  faces: [
    face({
      id: 'vf',
      styleName: 'Variable',
      isVariable: true,
      axes: [{ tag: 'wght', min: 100, max: 900, default: 400 }],
      filename: 'Inter[wght].woff2',
      woff2: { storagePath: 's/inter/1/Inter[wght].woff2', url: 'https://cdn.test/s/inter/1/Inter[wght].woff2' },
    }),
  ],
};

export const roboto: FontFamilyDoc = {
  id: 'roboto',
  slug: 'roboto',
  name: 'Roboto',
  fileBase: 'Roboto',
  category: 'SANS_SERIF',
  status: 'ready',
  version: 2,
  faces: [
    face({
      id: 'regular',
      weight: 400,
      filename: 'Roboto-Regular.woff2',
      woff2: { storagePath: 's/roboto/2/Roboto-Regular.woff2', url: 'https://cdn.test/s/roboto/2/Roboto-Regular.woff2' },
    }),
    face({
      id: 'bold',
      weight: 700,
      weightName: 'Bold',
      styleName: 'Bold',
      filename: 'Roboto-Bold.woff2',
      woff2: { storagePath: 's/roboto/2/Roboto-Bold.woff2', url: 'https://cdn.test/s/roboto/2/Roboto-Bold.woff2' },
    }),
  ],
};
