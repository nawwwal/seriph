import type { Firestore } from "firebase-admin/firestore";
import type { ArchiveChild, ArchiveDiscovery } from "./discoverZip";
import { completeArchiveIfReady, createItemOnce, markArchiveInventoryDurableOnce } from "../store/itemStore";
import type { ImportTaskPayload } from "../tasks/enqueue";

export interface ArchivePersistenceDependencies {
  stage(child: ArchiveChild): Promise<void>;
  enqueue(task: ImportTaskPayload): Promise<unknown>;
  ownerId?: string;
  batchId?: string;
}

export interface ArchivePersistenceResult {
  createdItems: number;
  stagedChildren: number;
  enqueuedChildren: number;
}

export async function persistArchiveDiscovery(
  db: Firestore, archiveItemId: string, discovery: ArchiveDiscovery, deps: ArchivePersistenceDependencies,
): Promise<ArchivePersistenceResult> {
  let createdItems = 0; let stagedChildren = 0; let enqueuedChildren = 0;
  for (const child of discovery.children) {
    const item = await createItemOnce(db, { ...child.inventory, stagingPath: child.staging.path });
    if (item.kind === "batch_missing") throw new Error("import batch missing while persisting archive child");
    if (item.kind === "created") createdItems += 1;
    await deps.stage(child); stagedChildren += 1;
    await deps.enqueue(child.task); enqueuedChildren += 1;
  }
  const first = discovery.children[0]?.inventory;
  const ownerId = first?.ownerId ?? deps.ownerId; const batchId = first?.batchId ?? deps.batchId;
  if (ownerId && batchId) {
    await markArchiveInventoryDurableOnce(db, {
      ownerId, batchId, itemId: archiveItemId,
    expectedChildren: discovery.children.length, reviewCount: discovery.reviews.length,
    });
    await completeArchiveIfReady(db, { ownerId, batchId, itemId: archiveItemId });
  }
  return { createdItems, stagedChildren, enqueuedChildren };
}
