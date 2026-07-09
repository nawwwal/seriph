import { describe, expect, it } from 'vitest';
import { deriveFamilyDetailRouteState } from '@/lib/hooks/familyDetailRouteState';

describe('family detail route state', () => {
  it('exits loading with distinct not-found and load-error outcomes', () => {
    const notFound = deriveFamilyDetailRouteState({
      activeFamilyId: 'missing-family',
      authLoading: false,
      hasUser: true,
      request: { familyId: 'missing-family', outcome: { kind: 'not-found' } },
    });
    const loadError = deriveFamilyDetailRouteState({
      activeFamilyId: 'inter',
      authLoading: false,
      hasUser: true,
      request: {
        familyId: 'inter',
        outcome: { kind: 'load-error', error: new Error('Service unavailable') },
      },
    });

    expect(notFound).toMatchObject({ kind: 'not-found', isLoading: false, family: null });
    expect(loadError).toMatchObject({ kind: 'load-error', isLoading: false, family: null });
  });
});
