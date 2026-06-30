'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  emptyInfiniteFamiliesState,
  inactiveFamiliesState,
} from '@/lib/hooks/infiniteFamiliesState';
import { useInfiniteFamiliesLoadMore } from '@/lib/hooks/useInfiniteFamiliesLoadMore';
import { useInfiniteFamiliesReload } from '@/lib/hooks/useInfiniteFamiliesReload';
export { clearShelfFamilyCache } from '@/lib/shelf/familyPageCache';

export function useInfiniteFamilies() {
  const { user, isLoading: authLoading } = useAuth();
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const moreRequestId = useRef(0);
  const moreAbortRef = useRef<AbortController | null>(null);
  const inFlightMore = useRef(false);
  const currentUserId = user?.uid ?? null;
  const [state, setState] = useState(emptyInfiniteFamiliesState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const activeState = useMemo(
    () => state.userId === currentUserId ? state : inactiveFamiliesState(state),
    [currentUserId, state]
  );
  const reload = useInfiniteFamiliesReload({
    abortRef,
    authLoading,
    inFlightMore,
    moreAbortRef,
    moreRequestId,
    requestId,
    setState,
    user,
  });
  const loadMore = useInfiniteFamiliesLoadMore({
    activeState,
    inFlightMore,
    moreAbortRef,
    moreRequestId,
    setState,
    stateRef,
    user,
  });
  useEffect(() => { void reload(); }, [reload]);
  return useMemo(() => ({
    families: activeState.families,
    hasMore: activeState.hasMore,
    isInitialLoading: authLoading || activeState.isInitialLoading,
    isRefreshing: activeState.isRefreshing,
    isLoadingMore: activeState.isLoadingMore,
    error: activeState.error,
    stats: activeState.stats,
    reload,
    loadMore,
  }), [activeState, authLoading, loadMore, reload]);
}
