import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFamilyPreviewCacheForUser,
  getCachedFamilyPreview,
} from '@/lib/cache/familyPreviewCache';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import type { FamilyDetailPreviewInput } from '@/lib/cache/familyDetailPreview';
import { readPersistedFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';

const harness = vi.hoisted(() => ({
  routePrefetch: vi.fn(),
  detailPrefetch: vi.fn(async () => {}),
  getIdToken: vi.fn(async () => 'token'),
  enqueue: vi.fn((_key: string, task: () => Promise<void>) => { void task(); }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: harness.routePrefetch }),
}));
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-a', getIdToken: harness.getIdToken } }),
}));
vi.mock('@/lib/cache/familyDetailClient', () => ({
  prefetchFamilyDetail: harness.detailPrefetch,
}));
vi.mock('@/lib/cache/familyDetailPrefetchQueue', () => ({
  familyDetailPrefetchQueue: { enqueue: harness.enqueue },
}));

function renderPrefetch(familyId: string, preview?: FamilyDetailPreviewInput): () => void {
  let callback: (() => void) | null = null;
  function HookHarness() {
    callback = useFamilyRoutePrefetch(familyId, true, preview);
    return null;
  }
  renderToStaticMarkup(createElement(HookHarness));
  if (!callback) throw new Error('Prefetch hook did not render.');
  return callback;
}

describe('useFamilyRoutePrefetch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    clearFamilyPreviewCacheForUser('user-a');
    await clearAccountSnapshots({ accountId: 'user-a' });
  });

  it('passes the card family identity through to the route and detail prefetch', () => {
    const prefetch = renderPrefetch('abc-ginto-nord');

    prefetch();

    expect(harness.routePrefetch).toHaveBeenCalledWith('/family/abc-ginto-nord');
    expect(harness.enqueue).toHaveBeenCalledWith('user-a:abc-ginto-nord', expect.any(Function));
    expect(harness.detailPrefetch).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user-a',
      familyId: 'abc-ginto-nord',
    }));
  });

  it('seeds a rich search preview without persisting or downgrading it', async () => {
    const preview: FamilyDetailPreviewInput = {
      kind: 'search',
      item: {
        id: 'aeonik-id', slug: 'aeonik', name: 'Aeonik', normalizedName: 'aeonik',
        category: 'NEO_GROTESK', classification: 'Sans Serif',
        summary: 'A precise neo-grotesk.', moods: ['precise'], useCases: ['product UI'],
        styleCount: 12, isVariable: false, updatedAt: '2026-07-10T00:00:00.000Z',
      },
    };
    const prefetch = renderPrefetch('aeonik', preview);

    prefetch();

    expect(getCachedFamilyPreview('user-a', 'aeonik')).toMatchObject({
      description: 'A precise neo-grotesk.',
      metadata: { moods: ['precise'], useCases: ['product UI'] },
    });
    const shelfPrefetch = renderPrefetch('aeonik', { kind: 'shelf', family: {
      id: 'aeonik', name: 'Aeonik', normalizedName: 'aeonik', classification: 'Sans Serif',
      styleCount: 12, isVariable: false, updatedAt: '2026-07-10T00:00:00.000Z',
    } });
    shelfPrefetch();
    expect(getCachedFamilyPreview('user-a', 'aeonik')?.description).toBe('A precise neo-grotesk.');
    expect(await readPersistedFamilyDetail('user-a', 'aeonik')).toBeNull();
  });
});
