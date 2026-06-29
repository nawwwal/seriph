export const searchQueryChangedEvent = 'seriph-search-query-change';

export function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

export function notifySearchQueryChange(query: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(searchQueryChangedEvent, { detail: { query } }));
}

export function queryFromSearchEvent(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const query = event.detail?.query;
  return typeof query === 'string' ? query : null;
}
