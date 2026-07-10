import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  rememberPersistedFamilyDetailAliases,
  takePersistedFamilyDetailAliases,
} from '@/lib/cache/familyDetailAliasRegistry';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';

describe('family detail alias registry', () => {
  beforeEach(async () => {
    await clearAccountSnapshots({ accountId: 'user-a' });
    await clearAccountSnapshots({ accountId: 'user-b' });
  });

  it('retains aliases discovered concurrently without crossing account boundaries', async () => {
    await Promise.all([
      rememberPersistedFamilyDetailAliases({
        accountId: 'user-a', canonicalId: 'aeonik-pro', aliases: ['aeonik'],
      }),
      rememberPersistedFamilyDetailAliases({
        accountId: 'user-a', canonicalId: 'aeonik-pro', aliases: ['aeonik-legacy'],
      }),
      rememberPersistedFamilyDetailAliases({
        accountId: 'user-b', canonicalId: 'aeonik-pro', aliases: ['other-account-alias'],
      }),
    ]);

    await expect(takePersistedFamilyDetailAliases({ accountId: 'user-a', familyId: 'aeonik-pro' }))
      .resolves.toEqual(expect.arrayContaining(['aeonik-pro', 'aeonik', 'aeonik-legacy']));
    await expect(takePersistedFamilyDetailAliases({ accountId: 'user-b', familyId: 'aeonik-pro' }))
      .resolves.toEqual(expect.arrayContaining(['aeonik-pro', 'other-account-alias']));
  });

  it('keeps aliases outside the 24-entry detail LRU', async () => {
    await rememberPersistedFamilyDetailAliases({
      accountId: 'user-a', canonicalId: 'aeonik-pro', aliases: ['aeonik'],
    });
    for (let index = 0; index < 25; index += 1) {
      await writeSnapshot({
        accountId: 'user-a', kind: 'family-detail', key: `family-${index}`,
        payload: index, ttlMs: 60_000, maxEntries: 24,
      });
    }

    await expect(takePersistedFamilyDetailAliases({ accountId: 'user-a', familyId: 'aeonik-pro' }))
      .resolves.toEqual(expect.arrayContaining(['aeonik-pro', 'aeonik']));
  });
});
