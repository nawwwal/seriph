'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import { fetchFamilyPage } from '@/lib/shelf/familyPageApi';
import { appendShelfFamilyPage, writeShelfFamilyCache } from '@/lib/shelf/familyPageCache';
import {
  type InfiniteFamiliesState,
  isAbortError,
  loadErrorMessage,
  pageFromInfiniteState,
} from '@/lib/hooks/infiniteFamiliesState';

interface LoadMoreArgs {
  inFlightMoreRef: MutableRefObject<boolean>;
  moreAbortRef: MutableRefObject<AbortController | null>;
  moreRequestIdRef: MutableRefObject<number>;
  setState: Dispatch<SetStateAction<InfiniteFamiliesState>>;
  stateRef: MutableRefObject<InfiniteFamiliesState>;
  user: Pick<User, 'uid' | 'getIdToken'> | null;
}

export function useInfiniteFamiliesLoadMore(args: LoadMoreArgs) {
  const { inFlightMoreRef, moreAbortRef, moreRequestIdRef, setState, stateRef, user } = args;

  return useCallback(async () => {
    if (!user || inFlightMoreRef.current || stateRef.current.userId !== user.uid) return;
    const continuation = stateRef.current;
    if (continuation.isRefreshing || !continuation.hasMore || !continuation.nextCursor) return;
    inFlightMoreRef.current = true;
    moreAbortRef.current?.abort();
    const controller = new AbortController();
    moreAbortRef.current = controller;
    moreRequestIdRef.current += 1;
    const id = moreRequestIdRef.current;
    stateRef.current = { ...continuation, isLoadingMore: true, error: null };
    setState(stateRef.current);

    try {
      const page = await fetchFamilyPage({
        getIdToken: () => user.getIdToken(),
        cursor: continuation.nextCursor,
        signal: controller.signal,
      });
      if (moreRequestIdRef.current !== id) return;
      const current = stateRef.current;
      const mergedPage = appendShelfFamilyPage(pageFromInfiniteState(current), page);
      writeShelfFamilyCache(user.uid, mergedPage);
      stateRef.current = {
        ...current,
        userId: user.uid,
        families: mergedPage.families,
        nextCursor: mergedPage.nextCursor,
        hasMore: mergedPage.hasMore,
        isLoadingMore: false,
        stats: mergedPage.stats ?? null,
      };
      setState(stateRef.current);
    } catch (error) {
      if (!isAbortError(error) && moreRequestIdRef.current === id) {
        stateRef.current = { ...stateRef.current, isLoadingMore: false, error: loadErrorMessage(error, 'Failed to load more families.') };
        setState(stateRef.current);
      }
    } finally {
      if (moreRequestIdRef.current === id) inFlightMoreRef.current = false;
    }
  }, [inFlightMoreRef, moreAbortRef, moreRequestIdRef, setState, stateRef, user]);
}
