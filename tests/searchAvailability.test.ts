import { describe, expect, it } from 'vitest';
import { searchErrorForDisplay } from '@/lib/search/searchAvailability';

describe('searchErrorForDisplay', () => {
  it('does not block visible local search results with backend refinement failures', () => {
    expect(searchErrorForDisplay({
      hasResults: true,
      indexError: 'Search index failed',
      indexLoading: false,
    })).toBeNull();
  });

  it('waits for the local index before showing a blocking search error', () => {
    expect(searchErrorForDisplay({
      hasResults: false,
      indexError: 'Search index failed',
      indexLoading: true,
    })).toBeNull();
  });

  it('shows the local index error when no results can be rendered', () => {
    expect(searchErrorForDisplay({
      hasResults: false,
      indexError: 'Search index failed',
      indexLoading: false,
    })).toBe('Search index failed');
  });
});
