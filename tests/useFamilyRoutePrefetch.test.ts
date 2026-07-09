import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';

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

function renderPrefetch(familyId: string): () => void {
  let callback: (() => void) | null = null;
  function HookHarness() {
    callback = useFamilyRoutePrefetch(familyId);
    return null;
  }
  renderToStaticMarkup(createElement(HookHarness));
  if (!callback) throw new Error('Prefetch hook did not render.');
  return callback;
}

describe('useFamilyRoutePrefetch', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
