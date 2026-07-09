import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFontSearch } from '@/lib/hooks/useFontSearch';
import { searchFiltersKey } from '@/lib/search/searchFilterUrl';
import type { SearchFilters, SearchIndexItem } from '@/models/search.models';

const harness = vi.hoisted(() => ({
  params: new URLSearchParams(), items: new Map<string, object[]>(), revision: 7,
  semanticStates: new Map<string, object | null>(), calls: new Array<{ query: string; variable: string }>(),
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => harness.params }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'ada' }, isLoading: false }) }));
vi.mock('@/lib/hooks/useSearchIndex', () => ({
  useSearchIndex: () => ({ items: harness.items.get('active') ?? [], libraryRevision: harness.revision, isLoading: false, error: null }),
}));
vi.mock('@/lib/hooks/useSemanticFontSearch', () => ({
  useSemanticFontSearch: (query: string, _user: unknown, filters: { variable: string }) => {
    harness.calls.push({ query, variable: filters.variable });
    return harness.semanticStates.get('active') ?? null;
  },
}));

const items: SearchIndexItem[] = [
  { id: 'mono-one', slug: 'mono-one', normalizedName: 'mono-one', name: 'Technical Mono One', category: 'MONOSPACE', classification: 'Monospace', styleCount: 4, isVariable: true, updatedAt: '', searchText: 'technical mono one', searchTokens: ['technical', 'mono', 'one'] },
  { id: 'mono-two', slug: 'mono-two', normalizedName: 'mono-two', name: 'Technical Mono Two', category: 'MONOSPACE', classification: 'Monospace', styleCount: 6, isVariable: true, updatedAt: '', searchText: 'technical mono two', searchTokens: ['technical', 'mono', 'two'] },
  { id: 'mono-three', slug: 'mono-three', normalizedName: 'mono-three', name: 'Technical Mono Three', category: 'MONOSPACE', classification: 'Monospace', styleCount: 8, isVariable: true, updatedAt: '', searchText: 'technical mono three', searchTokens: ['technical', 'mono', 'three'] },
];
const anyFilters: SearchFilters = { classifications: [], moods: [], styleRanges: [], variable: 'any' };

function renderSearch() {
  const captured: { current: ReturnType<typeof useFontSearch> | null } = { current: null };
  function Harness() { captured.current = useFontSearch(); return null; }
  renderToStaticMarkup(createElement(Harness));
  if (!captured.current) throw new Error('Search hook did not render.');
  return captured.current;
}

beforeEach(() => {
  harness.params = new URLSearchParams();
  harness.items.clear(); harness.items.set('active', items);
  harness.semanticStates.clear(); harness.calls.length = 0;
});

describe('useFontSearch', () => {
  it('keeps current local candidates when a prior filter tuple resolves late', () => {
    harness.params = new URLSearchParams({ q: 'technical mono' });
    renderSearch();
    harness.semanticStates.set('active', {
      query: 'technical mono', userId: 'ada', filtersKey: searchFiltersKey(anyFilters), libraryRevision: harness.revision,
      results: [{ id: 'semantic-suggestion', slug: 'semantic-suggestion', normalizedName: 'semantic-suggestion', name: 'Semantic Suggestion', category: 'DISPLAY', classification: 'Display', styleCount: 2, isVariable: true, updatedAt: '', source: 'semantic' }],
      error: null, loading: false,
    });
    harness.params = new URLSearchParams({ q: 'technical mono', variable: 'variable' });
    const current = renderSearch();

    expect(harness.calls).toEqual([{ query: 'technical mono', variable: 'any' }, { query: 'technical mono', variable: 'variable' }]);
    expect(current.results.map((item) => item.id)).toEqual(['mono-one', 'mono-three', 'mono-two']);
  });
});
