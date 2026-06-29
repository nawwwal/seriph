import { describe, expect, it } from 'vitest';
import { isCatalogAliasDoc, mergedInto } from '@/lib/db/catalogAdapter';

describe('catalog alias helpers', () => {
  it('recognizes merge tombstones as aliases instead of visible families', () => {
    const alias = {
      slug: 'abc-ginto-nord-black',
      status: 'merged',
      hidden: true,
      mergedInto: 'abc-ginto-nord',
    };

    expect(isCatalogAliasDoc(alias)).toBe(true);
    expect(mergedInto(alias)).toBe('abc-ginto-nord');
    expect(isCatalogAliasDoc({ slug: 'abc-ginto-nord', status: 'ready' })).toBe(false);
  });
});
