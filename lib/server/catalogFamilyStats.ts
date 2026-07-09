import type { Firestore } from 'firebase-admin/firestore';
import type { ShelfStatsSummary } from '@/models/shelf.models';
import { readCatalogSummary, rebuildCatalogSummary } from '@/lib/server/catalogSummary';

export function clearShelfStatsCache(_uid: string): void {}

export async function getShelfStats(db: Firestore, uid: string): Promise<ShelfStatsSummary> {
  return (await readCatalogSummary(db, uid)) ?? rebuildCatalogSummary(db, uid);
}
