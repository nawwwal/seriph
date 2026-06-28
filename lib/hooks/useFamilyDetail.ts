'use client';

import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { getFontFamilyById } from '@/lib/db/firestoreUtils';
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
  const [family, setFamily] = useState<FontFamily | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (!familyId) {
      setError('Font family ID is not available in the route.');
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const raw = await getFontFamilyById(familyId);
        if (raw) setFamily(serialize(raw) as FontFamily);
        else setError('Font family not found. It might have been moved or deleted.');
      } catch (err) {
        console.error(`Error fetching font family ${familyId}:`, err);
        setError('Could not load the font family details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [familyId, user, authLoading]);

  return { family, isLoading: authLoading || isLoading, error };
}
