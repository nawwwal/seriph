import { describe, expect, it } from 'vitest';
import type { FamilyDetailLoadOutcome } from '@/lib/cache/familyDetailClient';
import { deriveFamilyDetailRouteState } from '@/lib/hooks/familyDetailRouteState';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
import { rawFamily } from './fixtures/familyDetail';

describe('family detail route state', () => {
  it('exits loading with distinct not-found and load-error outcomes', () => {
    const notFound = deriveFamilyDetailRouteState({
      activeUid: 'user-a',
      activeFamilyId: 'missing-family',
      authLoading: false,
      hasUser: true,
      request: { uid: 'user-a', familyId: 'missing-family', outcome: { kind: 'not-found' } },
    });
    const loadError = deriveFamilyDetailRouteState({
      activeUid: 'user-a',
      activeFamilyId: 'inter',
      authLoading: false,
      hasUser: true,
      request: {
        uid: 'user-a',
        familyId: 'inter',
        outcome: { kind: 'load-error', error: new Error('Service unavailable') },
      },
    });

    expect(notFound).toMatchObject({ kind: 'not-found', isLoading: false, family: null });
    expect(loadError).toMatchObject({ kind: 'load-error', isLoading: false, family: null });
  });

  it('never renders loaded, missing, or error outcomes from another account', () => {
    const family = serializeFamilyDetail(rawFamily);
    if (!family) throw new Error('Expected a valid family fixture.');
    const staleOutcomes: FamilyDetailLoadOutcome[] = [
      { kind: 'loaded', family },
      { kind: 'not-found' },
      { kind: 'load-error', error: new Error('Account A failure') },
    ];

    for (const outcome of staleOutcomes) {
      const state = deriveFamilyDetailRouteState({
        activeUid: 'user-b',
        activeFamilyId: 'inter',
        authLoading: false,
        hasUser: true,
        request: { uid: 'user-a', familyId: 'inter', outcome },
      });

      expect(state).toMatchObject({ kind: 'loading', family: null, error: null, isLoading: true });
    }
  });

  it('keeps a visible preview when a background detail request fails retryably', () => {
    const preview = serializeFamilyDetail(rawFamily);
    if (!preview) throw new Error('Expected a valid family fixture.');

    const state = deriveFamilyDetailRouteState({
      activeUid: 'user-a',
      activeFamilyId: 'inter',
      authLoading: false,
      hasUser: true,
      request: {
        uid: 'user-a',
        familyId: 'inter',
        outcome: { kind: 'load-error', error: new Error('Service unavailable') },
      },
      preview,
    });

    expect(state).toMatchObject({
      kind: 'preview',
      family: preview,
      isLoading: false,
      isPreview: true,
      error: 'Could not load the font family details. Please try again later.',
    });
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
});
