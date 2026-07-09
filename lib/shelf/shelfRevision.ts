import type { PaginatedFamiliesResponse, ShelfStatsSummary } from '@/models/shelf.models';

export function hasMatchingShelfRevision(
  page: PaginatedFamiliesResponse | null,
  stats: ShelfStatsSummary
): boolean {
  return page?.stats?.libraryRevision === stats.libraryRevision;
}
