'use client';

import { useCallback, useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { getAllFontFamilies } from '@/lib/db/firestoreUtils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';

const CACHE_KEY = 'fontFamiliesCache_all';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function serialize(families: any[]): FontFamily[] {
  const iso = (v: any) => (v instanceof Timestamp ? v.toDate().toISOString() : String(v));
  return families.map((f) => ({ ...f, uploadDate: iso(f.uploadDate), lastModified: iso(f.lastModified) }));
}

/** Server-side fallback (admin SDK) used when the client query is permission-denied or empty. */
async function fetchFromServer(getIdToken: () => Promise<string>): Promise<FontFamily[]> {
  const idToken = await getIdToken();
  const res = await fetch('/api/families', { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`Server fetch failed: ${res.status}`);
  const json = await res.json();
  return serialize(json.families ?? []);
}

/** Loads the signed-in user's families (cache → client query → server fallback). */
export function useFamilies() {
  const { user, isLoading: authLoading } = useAuth();
  const { onCompleted } = useUploads();
  const [families, setFamilies] = useState<FontFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setFamilies([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const cacheKey = `${CACHE_KEY}_${user.uid}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS && data.length > 0) {
          setFamilies(serialize(data));
          setIsLoading(false);
          return;
        }
      }

      const { families: raw, errorCode, errorMessage } = await getAllFontFamilies(user.uid);
      let result = errorCode ? [] : serialize(raw);
      if (errorCode === 'permission-denied' || (!errorCode && result.length === 0)) {
        try {
          result = await fetchFromServer(() => user.getIdToken());
        } catch (e) {
          if (errorCode === 'permission-denied') throw e;
        }
      } else if (errorCode) {
        throw new Error(errorMessage || 'Failed to load font families.');
      }

      setFamilies(result);
      if (result.length > 0) localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
    } catch (err) {
      console.error('Error fetching font families:', err);
      setError("Sorry, we couldn't load the font families. Please try refreshing the page.");
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading) reload();
  }, [authLoading, reload]);

  // Refresh (debounced) when any upload completes.
  useEffect(() => onCompleted(reload), [onCompleted, reload]);

  return { families, isLoading, error, reload };
}
