'use client';

import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { getFontFamilyById } from '@/lib/db/firestoreUtils';
import { cacheFamily, getCachedFamily } from '@/lib/cache/familyCache';
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
  const activeFamilyId = familyId ?? null;
  // The shelf loads every family into the shared cache, so in-app navigation can
  // render the detail instantly without a refetch (back/forward feels immediate).
  const cached = user ? getCachedFamily(activeFamilyId ?? undefined) : undefined;
  const routeError = !authLoading && user && !activeFamilyId ? 'Font family ID is not available in the route.' : null;
  const hasCurrentFamilyState = state.familyId === activeFamilyId;
  const family = user ? (hasCurrentFamilyState ? state.family : cached ?? null) : null;
  const error = user ? routeError ?? (hasCurrentFamilyState ? state.error : null) : null;
  const isLoading = authLoading || Boolean(user && activeFamilyId && !hasCurrentFamilyState && !cached);

  useEffect(() => {
    if (authLoading || !user || !familyId) return;

    // Already in the shared cache → the derived value renders it; skip the fetch.
    if (getCachedFamily(familyId)) return;

    let isActive = true;
    getFontFamilyById(familyId)
      .then((raw) => {
        if (!isActive) return;
        const serialized = raw ? serialize(raw) : null;
        if (serialized) cacheFamily(serialized);
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
