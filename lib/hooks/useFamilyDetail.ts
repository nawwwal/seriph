'use client';

import { useEffect, useRef, useState } from 'react';
import type { FontFamily } from '@/models/font.models';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail } from '@/lib/cache/familyDetailClient';
import { clearFamilyPreviewCacheForUser, getCachedFamilyPreview } from '@/lib/cache/familyPreviewCache';
import { useAuth } from '@/lib/contexts/AuthContext';

/** Load one family by id (owner-scoped). Returns null family when logged out. */
export function useFamilyDetail(familyId: string | undefined) {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<{
    familyId: string | null;
    family: FontFamily | null;
    error: string | null;
  }>({ familyId: null, family: null, error: null });
  const previousUid = useRef<string | null>(null);
  const activeFamilyId = familyId ?? null;
  const activeUid = user?.uid;
  // Detail navigation can still be instant when a full family was already loaded
  // in this session; the shelf itself now stores only lightweight summaries.
  const cached = getCachedFamily(activeUid, activeFamilyId ?? undefined);
  const preview = getCachedFamilyPreview(activeUid, activeFamilyId ?? undefined);
  const routeError = !authLoading && user && !activeFamilyId ? 'Font family ID is not available in the route.' : null;
  const hasCurrentFamilyState = state.familyId === activeFamilyId;
  const family = user ? (hasCurrentFamilyState ? state.family : cached ?? preview ?? null) : null;
  const error = user ? routeError ?? (hasCurrentFamilyState ? state.error : null) : null;
  const isPreview = Boolean(user && family && !hasCurrentFamilyState && !cached && preview);
  const isLoading = authLoading || Boolean(user && activeFamilyId && !hasCurrentFamilyState && !cached && !preview);

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
      .then((serialized) => {
        if (!isActive) return;
        setState({
          familyId,
          family: serialized,
          error: serialized ? null : 'Font family not found. It might have been moved or deleted.',
        });
      })
      .catch((err) => {
        if (!isActive) return;
        console.error(`Error fetching font family ${familyId}:`, err);
        setState({
          familyId,
          family: null,
          error: 'Could not load the font family details. Please try again later.',
        });
      });

    return () => {
      isActive = false;
    };
  }, [familyId, user, authLoading]);

  return { family, isLoading, error, isPreview };
}
