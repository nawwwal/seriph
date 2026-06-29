'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { clearShelfFamilyCache, readShelfFamilyCache, writeShelfFamilyCache } from '@/lib/shelf/familyPageCache';
import { fetchFamilyPage } from '@/lib/shelf/familyPageApi';
import type { ShelfFamily } from '@/models/shelf.models';
export { clearShelfFamilyCache } from '@/lib/shelf/familyPageCache';
interface ShelfState {
  userId: string | null;
  families: ShelfFamily[];
  nextCursor: string | null;
  hasMore: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
}
const emptyState: ShelfState = {
  userId: null,
  families: [],
  nextCursor: null,
  hasMore: false,
  isInitialLoading: false,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
};
function abortMessage(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
export function useInfiniteFamilies() {
  const { user, isLoading: authLoading } = useAuth();
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightMore = useRef(false);
  const currentUserId = user?.uid ?? null;
  const [state, setState] = useState<ShelfState>(emptyState);
  const activeState = useMemo(
    () => state.userId === currentUserId ? state : { ...state, families: [], error: null, hasMore: false, nextCursor: null },
    [currentUserId, state]
  );
  const nextRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestId.current += 1;
    return { controller, id: requestId.current };
  }, []);
  const reload = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      abortRef.current?.abort();
      setState(emptyState);
      return;
    }
    const { controller, id } = nextRequest();
    const cached = readShelfFamilyCache(user.uid);
    setState({ userId: user.uid, families: cached?.families ?? [], nextCursor: cached?.nextCursor ?? null, hasMore: cached?.hasMore ?? false, isInitialLoading: !cached, isRefreshing: Boolean(cached), isLoadingMore: false, error: null });
    try {
      const page = await fetchFamilyPage({ getIdToken: () => user.getIdToken(), cursor: null, signal: controller.signal });
      if (requestId.current !== id) return;
      writeShelfFamilyCache(user.uid, page);
      setState({ userId: user.uid, families: page.families, nextCursor: page.nextCursor, hasMore: page.hasMore, isInitialLoading: false, isRefreshing: false, isLoadingMore: false, error: null });
    } catch (error) {
      if (abortMessage(error) || requestId.current !== id) return;
      setState((current) => ({ ...current, userId: user.uid, isInitialLoading: false, isRefreshing: false, isLoadingMore: false, error: error instanceof Error ? error.message : 'Failed to load families.' }));
    }
  }, [authLoading, nextRequest, user]);
  const loadMore = useCallback(async () => {
    if (!user || inFlightMore.current || !activeState.hasMore || !activeState.nextCursor) return;
    inFlightMore.current = true;
    const { controller, id } = nextRequest();
    setState((current) => ({ ...current, isLoadingMore: true, error: null }));
    try {
      const page = await fetchFamilyPage({ getIdToken: () => user.getIdToken(), cursor: activeState.nextCursor, signal: controller.signal });
      if (requestId.current !== id) return;
      setState((current) => ({ ...current, userId: user.uid, families: [...current.families, ...page.families], nextCursor: page.nextCursor, hasMore: page.hasMore, isLoadingMore: false }));
    } catch (error) {
      if (!abortMessage(error) && requestId.current === id) {
        setState((current) => ({ ...current, isLoadingMore: false, error: error instanceof Error ? error.message : 'Failed to load more families.' }));
      }
    } finally {
      inFlightMore.current = false;
    }
  }, [activeState.hasMore, activeState.nextCursor, nextRequest, user]);
  useEffect(() => { void reload(); }, [reload]);
  return useMemo(() => ({
    families: activeState.families,
    hasMore: activeState.hasMore,
    isInitialLoading: authLoading || activeState.isInitialLoading,
    isRefreshing: activeState.isRefreshing,
    isLoadingMore: activeState.isLoadingMore,
    error: activeState.error,
    reload,
    loadMore,
  }), [activeState, authLoading, loadMore, reload]);
}
