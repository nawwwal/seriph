import { describe, expect, it } from 'vitest';
import { nextFamilyStatusAfterFaceMerge } from '../../src/storage/familyStore';
import type { FontFace, FontFamilyDoc } from '../../src/models/catalog.models';

function face(id: string, contentHash: string): FontFace {
  return {
    id,
    styleName: 'Regular',
    weight: 400,
    weightName: 'Regular',
    italic: false,
    isVariable: false,
    format: 'OTF',
    fileSize: 42,
    filename: `${id}.woff2`,
    woff2: { storagePath: `s/test/${id}.woff2`, url: `https://example.com/${id}.woff2` },
    original: { storagePath: `d/test/${id}.otf`, url: `https://example.com/${id}.otf` },
    contentHash,
  };
}

function family(status: FontFamilyDoc['status'], faces: FontFace[]): FontFamilyDoc {
  return {
    id: 'test-family',
    slug: 'test-family',
    name: 'Test Family',
    fileBase: 'TestFamily',
    category: 'SANS_SERIF',
    faces,
    status,
    version: 1,
  };
}

describe('nextFamilyStatusAfterFaceMerge', () => {
  it('keeps enriched when the incoming face is already represented', () => {
    const existingFace = face('regular', 'hash-a');

    expect(nextFamilyStatusAfterFaceMerge(family('enriched', [existingFace]), existingFace)).toBe('enriched');
  });

  it('returns ready when an enriched family receives a new face', () => {
    expect(nextFamilyStatusAfterFaceMerge(family('enriched', [face('regular', 'hash-a')]), face('bold', 'hash-b'))).toBe(
      'ready'
    );
  });
});
