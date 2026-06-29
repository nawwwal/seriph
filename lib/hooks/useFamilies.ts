'use client';

import { useCallback, useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { FontFamily } from '@/models/font.models';
import { getAllFontFamilies } from '@/lib/db/firestoreUtils';
import { cacheFamilies } from '@/lib/cache/familyCache';
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

async function loadFamiliesForUser(user: User): Promise<FontFamily[]> {
  const cacheKey = `${CACHE_KEY}_${user.uid}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL_MS && data.length > 0) {
      const families = serialize(data);
      cacheFamilies(families);
      return families;
    }
  }

  const { families: raw, errorCode, errorMessage } = await getAllFontFamilies(user.uid);
  let result = errorCode ? [] : serialize(raw);
  if (errorCode === 'permission-denied' || (!errorCode && result.length === 0)) {
    try {
      result = await fetchFromServer(() => user.getIdToken());
    } catch (error) {
      if (errorCode === 'permission-denied') throw error;
    }
  } else if (errorCode) {
    throw new Error(errorMessage || 'Failed to load font families.');
  }

  if (result.length > 0) {
    cacheFamilies(result);
    // Best-effort persistence: the full catalog can exceed the localStorage quota
    // at scale, so never let a write failure break loading (Firestore's IndexedDB
    // cache is the durable cross-reload layer).
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
    } catch {
      /* quota exceeded — rely on the Firestore offline cache instead */
    }
  }
  return result;
}

interface FamiliesState {
  userId: string | null;
  families: FontFamily[];
  isRefreshing: boolean;
  error: string | null;
}

/** Loads the signed-in user's families (cache → client query → server fallback). */
export function useFamilies() {
  const { user, isLoading: authLoading } = useAuth();
  const { onCompleted } = useUploads();
  const [state, setState] = useState<FamiliesState>({
    userId: null,
    families: [],
    isRefreshing: false,
    error: null,
  });
  const currentUserId = user?.uid ?? null;
  const families = state.userId === currentUserId ? state.families : [];
  const error = state.userId === currentUserId ? state.error : null;
  const isLoading = authLoading || Boolean(currentUserId && (state.userId !== currentUserId || state.isRefreshing));

  const reload = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setState({ userId: null, families: [], isRefreshing: false, error: null });
      return;
    }
    const reloadUser = user;
    setState((current) => ({
      userId: reloadUser.uid,
      families: current.userId === reloadUser.uid ? current.families : [],
      isRefreshing: true,
      error: null,
    }));
    try {
      const result = await loadFamiliesForUser(reloadUser);
      setState({ userId: reloadUser.uid, families: result, isRefreshing: false, error: null });
    } catch (err) {
      console.error('Error fetching font families:', err);
      setState({
        userId: reloadUser.uid,
        families: [],
        isRefreshing: false,
        error: "Sorry, we couldn't load the font families. Please try refreshing the page.",
      });
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;

    let isActive = true;
    const loadUser = user;
    loadFamiliesForUser(loadUser)
      .then((result) => {
        if (!isActive) return;
        setState({ userId: loadUser.uid, families: result, isRefreshing: false, error: null });
      })
      .catch((err) => {
        if (!isActive) return;
        console.error('Error fetching font families:', err);
        setState({
          userId: loadUser.uid,
          families: [],
          isRefreshing: false,
          error: "Sorry, we couldn't load the font families. Please try refreshing the page.",
        });
      });

    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  // Refresh (debounced) when any upload completes.
  useEffect(() => onCompleted(reload), [onCompleted, reload]);

  return { families, isLoading, error, reload };
}
