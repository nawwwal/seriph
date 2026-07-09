import '../bootstrap/adminApp';
import { getFirestore } from 'firebase-admin/firestore';
import { rebuildCatalogSummary } from '../storage/catalogSummary';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import { parseCatalogSummaryBackfillArgs } from './backfillCatalogSummaries';

function ownerIds(records: Record<string, unknown>[]): string[] {
  return [...new Set(records.flatMap((record) => typeof record.ownerId === 'string' ? [record.ownerId] : []))];
}

export async function runCatalogSummaryBackfill(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCatalogSummaryBackfillArgs(argv);
  const db = getFirestore();
  const owners = args.ownerId
    ? [args.ownerId]
    : ownerIds((await db.collection(FAMILIES_COLLECTION).select('ownerId').get()).docs.map((doc) => doc.data()));
  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, ownerCount: owners.length, owners }));
    return;
  }
  for (const ownerId of owners) await rebuildCatalogSummary(db, ownerId);
  console.log(JSON.stringify({ dryRun: false, rebuilt: owners.length }));
}
