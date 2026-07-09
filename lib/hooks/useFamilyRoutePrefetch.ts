'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { prefetchFamilyDetail } from '@/lib/cache/familyDetailClient';
import { familyDetailPrefetchQueue } from '@/lib/cache/familyDetailPrefetchQueue';
import { cacheFamilyPreview } from '@/lib/cache/familyPreviewCache';
import type { ShelfFamily } from '@/models/shelf.models';

export function useFamilyRoutePrefetch(
  familyId: string | undefined,
  enabled = true,
  preview?: ShelfFamily
): () => void {
  const router = useRouter();
  const { user } = useAuth();
  const prefetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user || !preview) return;
    cacheFamilyPreview(user.uid, preview);
  }, [enabled, preview, user]);

  return useCallback(() => {
    if (!enabled || !familyId) return;
    router.prefetch(`/family/${familyId}`);
    if (!user) return;
    if (preview) cacheFamilyPreview(user.uid, preview);

    const key = `${user.uid}:${familyId}`;
    if (prefetchedKeyRef.current === key) return;
    prefetchedKeyRef.current = key;
    familyDetailPrefetchQueue.enqueue(key, () => prefetchFamilyDetail({
      uid: user.uid, familyId, getIdToken: () => user.getIdToken(),
    }));
  }, [enabled, familyId, preview, router, user]);
}
