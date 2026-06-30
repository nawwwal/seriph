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
  activeState: InfiniteFamiliesState;
  inFlightMore: MutableRefObject<boolean>;
  moreAbortRef: MutableRefObject<AbortController | null>;
  moreRequestId: MutableRefObject<number>;
  setState: Dispatch<SetStateAction<InfiniteFamiliesState>>;
  stateRef: MutableRefObject<InfiniteFamiliesState>;
  user: User | null;
}

export function useInfiniteFamiliesLoadMore(args: LoadMoreArgs) {
  const { activeState, inFlightMore, moreAbortRef, moreRequestId, setState, stateRef, user } = args;

  return useCallback(async () => {
    if (!user || inFlightMore.current || !activeState.hasMore || !activeState.nextCursor) return;
    inFlightMore.current = true;
    moreAbortRef.current?.abort();
    const controller = new AbortController();
    moreAbortRef.current = controller;
    moreRequestId.current += 1;
    const id = moreRequestId.current;
    setState((current) => ({ ...current, isLoadingMore: true, error: null }));

    try {
      const page = await fetchFamilyPage({
        getIdToken: () => user.getIdToken(),
        cursor: activeState.nextCursor,
        signal: controller.signal,
      });
      if (moreRequestId.current !== id) return;
      const current = stateRef.current.userId === user.uid ? stateRef.current : activeState;
      const mergedPage = appendShelfFamilyPage(pageFromInfiniteState(current), page);
      writeShelfFamilyCache(user.uid, mergedPage);
      setState((latest) => ({
        ...latest,
        userId: user.uid,
        families: mergedPage.families,
        nextCursor: mergedPage.nextCursor,
        hasMore: mergedPage.hasMore,
        isLoadingMore: false,
        stats: mergedPage.stats ?? null,
      }));
    } catch (error) {
      if (!isAbortError(error) && moreRequestId.current === id) {
        setState((current) => ({ ...current, isLoadingMore: false, error: loadErrorMessage(error, 'Failed to load more families.') }));
      }
    } finally {
      if (moreRequestId.current === id) inFlightMore.current = false;
    }
  }, [activeState, inFlightMore, moreAbortRef, moreRequestId, setState, stateRef, user]);
}
