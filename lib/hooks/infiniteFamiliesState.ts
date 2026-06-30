import type { PaginatedFamiliesResponse, ShelfFamily, ShelfStatsSummary } from '@/models/shelf.models';

export interface InfiniteFamiliesState {
  userId: string | null;
  families: ShelfFamily[];
  nextCursor: string | null;
  hasMore: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  stats: ShelfStatsSummary | null;
}

export const emptyInfiniteFamiliesState: InfiniteFamiliesState = {
  userId: null,
  families: [],
  nextCursor: null,
  hasMore: false,
  isInitialLoading: false,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
  stats: null,
};

export function inactiveFamiliesState(state: InfiniteFamiliesState): InfiniteFamiliesState {
  return { ...state, families: [], error: null, hasMore: false, nextCursor: null, stats: null };
}

export function stateFromShelfPage(
  uid: string,
  page: PaginatedFamiliesResponse,
  overrides: Partial<InfiniteFamiliesState> = {}
): InfiniteFamiliesState {
  return {
    userId: uid,
    families: page.families,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    isInitialLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    error: null,
    stats: page.stats ?? null,
    ...overrides,
  };
}

export function stateFromShelfCache(uid: string, cached: PaginatedFamiliesResponse | null): InfiniteFamiliesState {
  return stateFromShelfPage(uid, cached ?? { families: [], nextCursor: null, hasMore: false }, {
    isInitialLoading: !cached,
    isRefreshing: Boolean(cached),
  });
}

export function pageFromInfiniteState(state: InfiniteFamiliesState): PaginatedFamiliesResponse {
  return {
    families: state.families,
    nextCursor: state.nextCursor,
    hasMore: state.hasMore,
    ...(state.stats ? { stats: state.stats } : {}),
  };
}

export function loadErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
