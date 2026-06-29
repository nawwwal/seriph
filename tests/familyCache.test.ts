import { describe, expect, it } from 'vitest';
import { cacheFamily, clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import type { FontFamily } from '@/models/font.models';

function family(ownerId: string): FontFamily {
  return {
    id: 'inter',
    name: `Inter ${ownerId}`,
    normalizedName: 'inter',
    ownerId,
    fonts: [],
    description: '',
    metadata: {},
    uploadDate: '',
    lastModified: '',
    classification: 'Sans Serif',
    tags: [],
  };
}

describe('family detail cache', () => {
  it('keys full family detail by user and family id', () => {
    cacheFamily('user-a', family('user-a'));
    cacheFamily('user-b', family('user-b'));

    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter user-a');
    expect(getCachedFamily('user-b', 'inter')?.name).toBe('Inter user-b');
  });

  it('can clear one user without affecting another user', () => {
    cacheFamily('user-a', family('user-a'));
    cacheFamily('user-b', family('user-b'));

    clearFamilyCacheForUser('user-a');

    expect(getCachedFamily('user-a', 'inter')).toBeUndefined();
    expect(getCachedFamily('user-b', 'inter')?.name).toBe('Inter user-b');
  });
});
