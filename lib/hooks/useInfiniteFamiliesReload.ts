'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import { fetchFamilyPage, fetchShelfStats } from '@/lib/shelf/familyPageApi';
import { mergeShelfRefreshPage, readShelfFamilyCache, writeShelfFamilyCache } from '@/lib/shelf/familyPageCache';
import { readPersistentShelfCache } from '@/lib/shelf/persistentShelfCache';
import { hasMatchingShelfRevision } from '@/lib/shelf/shelfRevision';
import {
  emptyInfiniteFamiliesState,
  type InfiniteFamiliesState,
  isAbortError,
  loadErrorMessage,
  stateFromShelfCache,
  stateFromShelfPage,
} from '@/lib/hooks/infiniteFamiliesState';

interface ReloadArgs {
  abortRef: MutableRefObject<AbortController | null>;
  authLoading: boolean;
  inFlightMoreRef: MutableRefObject<boolean>;
  moreAbortRef: MutableRefObject<AbortController | null>;
  moreRequestIdRef: MutableRefObject<number>;
  requestId: MutableRefObject<number>;
  setState: Dispatch<SetStateAction<InfiniteFamiliesState>>;
  user: User | null;
}

function cancelMoreRequests(
  moreAbortRef: MutableRefObject<AbortController | null>,
  moreRequestIdRef: MutableRefObject<number>,
  inFlightMoreRef: MutableRefObject<boolean>
) {
  moreAbortRef.current?.abort();
  moreRequestIdRef.current += 1;
  inFlightMoreRef.current = false;
}

export function useInfiniteFamiliesReload(args: ReloadArgs) {
  const { abortRef, authLoading, inFlightMoreRef, moreAbortRef, moreRequestIdRef, requestId, setState, user } = args;

  return useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      abortRef.current?.abort();
      cancelMoreRequests(moreAbortRef, moreRequestIdRef, inFlightMoreRef);
      setState(emptyInfiniteFamiliesState);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestId.current += 1;
    const id = requestId.current;
    cancelMoreRequests(moreAbortRef, moreRequestIdRef, inFlightMoreRef);

    let cached = readShelfFamilyCache(user.uid);
    setState(stateFromShelfCache(user.uid, cached));
    const tokenPromise = user.getIdToken();
    const getIdToken = () => tokenPromise;
    const statsPromise = fetchShelfStats({ getIdToken, signal: controller.signal })
      .then((stats) => ({ ok: true as const, stats }))
      .catch((error: unknown) => ({ ok: false as const, error }));

    const persisted = await readPersistentShelfCache(user.uid);
    if (requestId.current !== id) return;
    if (persisted) {
      cached = persisted;
      setState(stateFromShelfCache(user.uid, cached));
    }

    if (cached) {
      const statsResult = await statsPromise;
      if (requestId.current !== id) return;
      if (statsResult.ok && hasMatchingShelfRevision(cached, statsResult.stats)) {
        const current = { ...cached, stats: statsResult.stats };
        writeShelfFamilyCache(user.uid, current);
        setState(stateFromShelfPage(user.uid, current));
        return;
      }
      if (!statsResult.ok && !isAbortError(statsResult.error)) console.warn('Failed to refresh shelf stats', statsResult.error);
    }

    try {
      const page = await fetchFamilyPage({ getIdToken, cursor: null, signal: controller.signal });
      if (requestId.current !== id) return;
      const refreshedPage = mergeShelfRefreshPage(cached, cached?.stats ? { ...page, stats: cached.stats } : page);
      writeShelfFamilyCache(user.uid, refreshedPage);
      setState(stateFromShelfPage(user.uid, refreshedPage));
      const statsResult = await statsPromise;
      if (requestId.current !== id) return;
      if (statsResult.ok) {
        writeShelfFamilyCache(user.uid, { ...refreshedPage, stats: statsResult.stats });
        setState((current) => ({ ...current, stats: statsResult.stats }));
      } else if (!isAbortError(statsResult.error)) console.warn('Failed to refresh shelf stats', statsResult.error);
    } catch (error) {
      if (isAbortError(error) || requestId.current !== id) return;
      setState((current) => ({
        ...current,
        userId: user.uid,
        isInitialLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: loadErrorMessage(error, 'Failed to load families.'),
      }));
    }
  }, [abortRef, authLoading, inFlightMoreRef, moreAbortRef, moreRequestIdRef, requestId, setState, user]);
}
