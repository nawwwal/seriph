'use client';

import { useEffect, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { cacheFamily, clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { useAuth } from '@/lib/contexts/AuthContext';

function serialize(family: any): FontFamily | null {
  if (!family) return null;
  const iso = (v: any) => (v instanceof Timestamp ? v.toDate().toISOString() : String(v));
  return {
    ...family,
    uploadDate: iso(family.uploadDate),
    lastModified: iso(family.lastModified),
    fonts: family.fonts ? family.fonts.map((font: any) => ({ ...font })) : [],
  };
}

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
  const routeError = !authLoading && user && !activeFamilyId ? 'Font family ID is not available in the route.' : null;
  const hasCurrentFamilyState = state.familyId === activeFamilyId;
  const family = user ? (hasCurrentFamilyState ? state.family : cached ?? null) : null;
  const error = user ? routeError ?? (hasCurrentFamilyState ? state.error : null) : null;
  const isLoading = authLoading || Boolean(user && activeFamilyId && !hasCurrentFamilyState && !cached);

  useEffect(() => {
    const previous = previousUid.current;
    if (previous && previous !== activeUid) clearFamilyCacheForUser(previous);
    previousUid.current = activeUid ?? null;
  }, [activeUid]);

  useEffect(() => {
    if (authLoading || !user || !familyId) return;
    // Already in the shared cache -> the derived value renders it; skip the fetch.
    if (getCachedFamily(user.uid, familyId)) return;

    let isActive = true;
    user.getIdToken()
      .then((token) =>
        fetch(`/api/v1/families/${encodeURIComponent(familyId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message || `Family request failed: ${response.status}`);
        return json?.data?.family ?? null;
      })
      .then((raw) => {
        if (!isActive) return;
        const serialized = raw ? serialize(raw) : null;
        if (serialized) cacheFamily(user.uid, serialized);
        setState({
          familyId,
          family: serialized,
          error: raw ? null : 'Font family not found. It might have been moved or deleted.',
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

  return { family, isLoading, error };
}
