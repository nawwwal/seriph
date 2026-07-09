import type { SearchIndexResponse } from '@/models/search.models';

export function preferSearchIndex(
  current: SearchIndexResponse | null,
  candidate: SearchIndexResponse | null
): SearchIndexResponse | null {
  if (!current || (candidate && candidate.libraryRevision > current.libraryRevision)) return candidate;
  return current;
}
