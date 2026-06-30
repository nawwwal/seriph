'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { fetchSearchIndexForUser } from '@/lib/search/searchApi';
import { readSearchIndexCache, readShelfSearchSeed, writeSearchIndexCache } from '@/lib/search/searchIndexCache';
import type { SearchIndexItem } from '@/models/search.models';

interface SearchIndexState {
  userId: string | null;
  items: SearchIndexItem[];
  isLoading: boolean;
  error: string | null;
}

const emptyState: SearchIndexState = { userId: null, items: [], isLoading: false, error: null };

function abortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useSearchIndex(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user, isLoading: authLoading } = useAuth();
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SearchIndexState>(emptyState);
  const userId = user?.uid ?? null;
  const activeState = state.userId === userId ? state : emptyState;

  const reload = useCallback(async () => {
    if (!enabled || authLoading) return;
    if (!user) {
      abortRef.current?.abort();
      setState(emptyState);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestId.current += 1;
    const id = requestId.current;
    const cached = readSearchIndexCache(user.uid) ?? readShelfSearchSeed(user.uid);
    setState({ userId: user.uid, items: cached?.items ?? [], isLoading: true, error: null });

    try {
      const index = await fetchSearchIndexForUser({ getIdToken: () => user.getIdToken(), signal: controller.signal });
      if (requestId.current !== id) return;
      writeSearchIndexCache(user.uid, index);
      setState({ userId: user.uid, items: index.items, isLoading: false, error: null });
    } catch (error) {
      if (abortError(error) || requestId.current !== id) return;
      setState((current) => ({ ...current, userId: user.uid, isLoading: false, error: error instanceof Error ? error.message : 'Search index failed' }));
    }
  }, [authLoading, enabled, user]);

  useEffect(() => {
    void reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  return useMemo(() => ({
    items: activeState.items,
    isLoading: authLoading || activeState.isLoading,
    error: activeState.error,
    reload,
  }), [activeState, authLoading, reload]);
}
