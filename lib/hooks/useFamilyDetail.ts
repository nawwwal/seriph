'use client';

import { useEffect, useRef, useState } from 'react';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail } from '@/lib/cache/familyDetailClient';
import { clearFamilyPreviewCacheForUser, getCachedFamilyPreview } from '@/lib/cache/familyPreviewCache';
import {
  deriveFamilyDetailRouteState,
  type FamilyDetailRequestState,
} from '@/lib/hooks/familyDetailRouteState';
import { useAuth } from '@/lib/contexts/AuthContext';

/** Load one family by id (owner-scoped). Returns null family when logged out. */
export function useFamilyDetail(familyId: string | undefined) {
  const { user, isLoading: authLoading } = useAuth();
  const [request, setRequest] = useState<FamilyDetailRequestState>({ familyId: null, outcome: null });
  const previousUid = useRef<string | null>(null);
  const activeFamilyId = familyId ?? null;
  const activeUid = user?.uid;
  // Detail navigation can still be instant when a full family was already loaded
  // in this session; the shelf itself now stores only lightweight summaries.
  const cached = getCachedFamily(activeUid, activeFamilyId ?? undefined);
  const preview = getCachedFamilyPreview(activeUid, activeFamilyId ?? undefined);
  const routeState = deriveFamilyDetailRouteState({
    activeFamilyId,
    authLoading,
    hasUser: Boolean(user),
    request,
    cached,
    preview,
  });

  useEffect(() => {
    const previous = previousUid.current;
    if (previous && previous !== activeUid) {
      clearFamilyCacheForUser(previous);
      clearFamilyPreviewCacheForUser(previous);
    }
    previousUid.current = activeUid ?? null;
  }, [activeUid]);

  useEffect(() => {
    if (authLoading || !user || !familyId) return;
    // Already in the shared cache -> the derived value renders it; skip the fetch.
    if (getCachedFamily(user.uid, familyId)) return;

    let isActive = true;
    loadFamilyDetail({
      uid: user.uid,
      familyId,
      getIdToken: () => user.getIdToken(),
    })
      .then((outcome) => {
        if (!isActive) return;
        if (outcome.kind === 'load-error') {
          console.error(`Error fetching font family ${familyId}:`, outcome.error);
        }
        setRequest({ familyId, outcome });
      });

    return () => {
      isActive = false;
    };
  }, [familyId, user, authLoading]);

  return routeState;
}
