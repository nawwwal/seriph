import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyDetailLoadOutcome } from '@/lib/cache/familyDetailClient';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { deriveFamilyDetailRouteState } from '@/lib/hooks/familyDetailRouteState';
import { loadFamilyDetailWithRefresh } from '@/lib/hooks/useFamilyDetail';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
import { rawFamily } from './fixtures/familyDetail';

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

describe('family detail route state', () => {
  beforeEach(async () => {
    clearFamilyCacheForUser('user-a'); await clearAccountSnapshots({ accountId: 'user-a' });
    vi.unstubAllGlobals();
  });

  it('exits loading with distinct not-found and load-error outcomes', () => {
    const notFound = deriveFamilyDetailRouteState({
      activeUid: 'user-a', activeFamilyId: 'missing-family', authLoading: false, hasUser: true,
      request: { uid: 'user-a', familyId: 'missing-family', outcome: { kind: 'not-found' } },
    });
    const loadError = deriveFamilyDetailRouteState({
      activeUid: 'user-a', activeFamilyId: 'inter', authLoading: false, hasUser: true,
      request: { uid: 'user-a', familyId: 'inter',
        outcome: { kind: 'load-error', error: new Error('Service unavailable') } },
    });

    expect(notFound).toMatchObject({ kind: 'not-found', isLoading: false, family: null });
    expect(loadError).toMatchObject({ kind: 'load-error', isLoading: false, family: null });
  });

  it('never renders loaded, missing, or error outcomes from another account', () => {
    const family = serializeFamilyDetail(rawFamily);
    if (!family) throw new Error('Expected a valid family fixture.');
    const staleOutcomes: FamilyDetailLoadOutcome[] = [
      { kind: 'loaded', source: 'memory', family },
      { kind: 'not-found' },
      { kind: 'load-error', error: new Error('Account A failure') },
    ];

    for (const outcome of staleOutcomes) {
      const state = deriveFamilyDetailRouteState({
        activeUid: 'user-b', activeFamilyId: 'inter', authLoading: false, hasUser: true,
        request: { uid: 'user-a', familyId: 'inter', outcome } });

      expect(state).toMatchObject({ kind: 'loading', family: null, error: null, isLoading: true });
    }
  });

  it('keeps a visible preview when a background detail request fails retryably', () => {
    const preview = serializeFamilyDetail(rawFamily);
    if (!preview) throw new Error('Expected a valid family fixture.');

    const state = deriveFamilyDetailRouteState({
      activeUid: 'user-a', activeFamilyId: 'inter', authLoading: false, hasUser: true,
      request: { uid: 'user-a', familyId: 'inter',
        outcome: { kind: 'load-error', error: new Error('Service unavailable') } }, preview });

    expect(state).toMatchObject({ kind: 'preview', family: preview, isLoading: false, isPreview: true,
      error: 'Could not load the font family details. Please try again later.' });
  });

  it('lets a definitive not-found outcome supersede a stale preview', () => {
    const preview = serializeFamilyDetail(rawFamily);
    if (!preview) throw new Error('Expected a valid family fixture.');

    const state = deriveFamilyDetailRouteState({
      activeUid: 'user-a', activeFamilyId: 'inter', authLoading: false, hasUser: true,
      request: { uid: 'user-a', familyId: 'inter', outcome: { kind: 'not-found' } },
      preview,
    });

    expect(state).toMatchObject({ kind: 'not-found', family: null, isPreview: false });
  });

  it('refreshes a memory-source detail in the background', async () => {
    const input = { uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { family: rawFamily } }) }));
    vi.stubGlobal('fetch', fetchMock); await loadFamilyDetailWithRefresh(input, () => {});
    const outcomes: FamilyDetailLoadOutcome[] = [];
    await loadFamilyDetailWithRefresh(input, (outcome) => outcomes.push(outcome));
    expect(outcomes.map((outcome) => outcome.kind === 'loaded' ? outcome.source : outcome.kind)).toEqual(['memory', 'network']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('publishes a legacy snapshot before its background enrichment refresh', async () => {
    const legacyFamily = { ...rawFamily, id: 'aeonik', normalizedName: 'aeonik' };
    await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'aeonik',
      payload: legacyFamily, ttlMs: 60_000 });
    let releaseResponse = () => {}; const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
    vi.stubGlobal('fetch', vi.fn(async () => {
      await responseGate;
      return { ok: true, status: 200, json: async () => ({ data: { family: {
        ...legacyFamily, description: 'A precise neo-grotesk.',
        metadata: { enrichment: { summary: 'A precise neo-grotesk.' } },
      } } }) };
    }));
    const outcomes: FamilyDetailLoadOutcome[] = [];

    const pending = loadFamilyDetailWithRefresh(
      { uid: 'user-a', familyId: 'aeonik', getIdToken: async () => 'token' },
      (outcome) => outcomes.push(outcome),
    );
    await vi.waitFor(() => expect(outcomes).toHaveLength(1));

    expect(outcomes[0]).toMatchObject({
      kind: 'loaded', source: 'snapshot', family: { description: '', metadata: {} } });
    expect(getCachedFamily('user-a', 'aeonik')?.metadata.enrichment).toBeUndefined();

    releaseResponse();
    await pending;
    expect(outcomes[1]).toMatchObject({ kind: 'loaded', source: 'network',
      family: { metadata: { enrichment: { summary: 'A precise neo-grotesk.' } } } });
    expect(getCachedFamily('user-a', 'aeonik')?.description).toBe('A precise neo-grotesk.');
  });
});
