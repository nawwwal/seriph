'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import {
  loadFamilyDetail,
  refreshFamilyDetail,
  type FamilyDetailLoadOutcome,
  type LoadFamilyDetailInput,
} from '@/lib/cache/familyDetailClient';
import { clearFamilyPreviewCacheForUser, getCachedFamilyPreview } from '@/lib/cache/familyPreviewCache';
import {
  deriveFamilyDetailRouteState,
  type FamilyDetailRequestState,
} from '@/lib/hooks/familyDetailRouteState';
import { useAuth } from '@/lib/contexts/AuthContext';

export async function loadFamilyDetailWithRefresh(
  input: LoadFamilyDetailInput,
  publish: (outcome: FamilyDetailLoadOutcome) => void,
): Promise<void> {
  const initial = await loadFamilyDetail(input);
  publish(initial);
  if (initial.kind === 'loaded' && initial.source !== 'network') {
    publish(await refreshFamilyDetail(input));
  }
}

export function useFamilyDetail(familyId: string | undefined) {
  const { user, isLoading: authLoading } = useAuth();
  const [request, setRequest] = useState<FamilyDetailRequestState>({ uid: null, familyId: null, outcome: null });
  const [reloadNonce, setReloadNonce] = useState(0);
  const previousUid = useRef<string | null>(null);
  const activeFamilyId = familyId ?? null;
  const activeUid = user?.uid;
  const cached = getCachedFamily(activeUid, activeFamilyId ?? undefined);
  const preview = getCachedFamilyPreview(activeUid, activeFamilyId ?? undefined);
  const routeState = deriveFamilyDetailRouteState({
    activeUid: activeUid ?? null,
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
    let isActive = true;
    const run = reloadNonce > 0
      ? refreshFamilyDetail(
          { uid: user.uid, familyId, getIdToken: (forceRefresh) => user.getIdToken(Boolean(forceRefresh)) },
        ).then((outcome) => {
          if (isActive) setRequest({ uid: user.uid, familyId, outcome });
        })
      : loadFamilyDetailWithRefresh(
          {
            uid: user.uid,
            familyId,
            getIdToken: (forceRefresh) => user.getIdToken(Boolean(forceRefresh)),
          },
          (outcome) => {
            if (!isActive) return;
            if (outcome.kind === 'load-error' && !/unauthorized/i.test(outcome.error.message)) {
              console.error(`Error fetching font family ${familyId}:`, outcome.error);
            }
            setRequest({ uid: user.uid, familyId, outcome });
          },
        );
    void run;

    return () => {
      isActive = false;
    };
  }, [familyId, user, authLoading, reloadNonce]);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);
  return { ...routeState, reload };
}
