import { describe, expect, it } from 'vitest';
import { buildManualMergeDisplayNameUpdate } from '../../src/ai/enrich/update';
import { parseAnalysis } from '../../src/ai/enrich/parse';
import type { FontFamilyDoc } from '../../src/models/catalog.models';

function family(overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id: 'merged-family',
    slug: 'merged-family',
    name: 'Merged Family',
    fileBase: 'MergedFamily',
    category: 'SANS_SERIF',
    faces: [],
    status: 'ready',
    version: 1,
    ...overrides,
  };
}

describe('enrichment suggested display name', () => {
  it('parses an optional suggested display name from analysis JSON', () => {
    const enrichment = parseAnalysis(
      family(),
      JSON.stringify({
        category: 'SANS_SERIF',
        suggestedDisplayName: 'ABC Ginto Nord',
        classification: 'grotesque sans',
        summary: 'A compact grotesque family.',
        moods: ['editorial'],
        useCases: ['headlines'],
      })
    );

    expect(enrichment?.suggestedDisplayName).toBe('ABC Ginto Nord');
  });

  it('applies the suggested display name only to manual merge families', () => {
    const mergedUpdate = buildManualMergeDisplayNameUpdate(
      family({ manualMerge: { displayNamePending: true } }),
      {
        category: 'SANS_SERIF',
        suggestedDisplayName: 'ABC Ginto Nord',
        summary: 'A compact grotesque family.',
        moods: ['editorial'],
        useCases: ['headlines'],
      }
    );
    const normalUpdate = buildManualMergeDisplayNameUpdate(
      family(),
      {
        category: 'SANS_SERIF',
        suggestedDisplayName: 'ABC Ginto Nord',
        summary: 'A compact grotesque family.',
        moods: ['editorial'],
        useCases: ['headlines'],
      }
    );

    expect(mergedUpdate.name).toBe('ABC Ginto Nord');
    expect(mergedUpdate.manualMerge).toEqual({ displayNamePending: false });
    expect(normalUpdate.name).toBeUndefined();
  });
});
