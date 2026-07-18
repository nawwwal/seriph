import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ImportArchiveLifecycle, ImportItemAction, ImportItemReason } from "../contracts/item";
import { importBatchRef } from "./paths";
import type { InventoryItem } from "../discovery/inventory";

const itemSegment = (value: string): string => {
  if (!value || value.includes("/")) throw new Error("invalid itemId");
  return value;
};

export const importItemRef = (db: Firestore, ownerId: string, batchId: string, itemId: string) =>
  importBatchRef(db, ownerId, batchId).collection("items").doc(itemSegment(itemId));

export type CreateItemResult = { kind: "created" | "exists" | "batch_missing"; itemId: string };

const persistedAction = (action: InventoryItem["action"]): ImportItemAction =>
  action === "parse" ? "apply" : action === "expand" || action === "retain_private" ? "keep_private" : action;
const persistedReason = (reasonCode: string): ImportItemReason => {
  const allowed: ImportItemReason[] = [
    "detected_font", "source_asset", "documentation", "web_asset", "archive_container",
    "unsupported_content", "ambiguous_identity", "unsafe_archive", "duplicate_content", "disposable_name",
  ];
  return allowed.includes(reasonCode as ImportItemReason) ? reasonCode as ImportItemReason : "unsupported_content";
};

export async function createItemOnce(db: Firestore, item: InventoryItem): Promise<CreateItemResult> {
  return db.runTransaction(async (tx) => {
    const batch = importBatchRef(db, item.ownerId, item.batchId);
    const ref = importItemRef(db, item.ownerId, item.batchId, item.itemId);
    const batchSnap = await tx.get(batch);
    const current = await tx.get(ref);
    if (current.exists) return { kind: "exists", itemId: item.itemId };
    if (!batchSnap.exists) return { kind: "batch_missing", itemId: item.itemId };
    const parentId = item.archiveLineage.at(-1)?.archiveItemId;
    const parent = parentId ? await tx.get(importItemRef(db, item.ownerId, item.batchId, parentId)) : undefined;
    const now = FieldValue.serverTimestamp() as unknown as string;
    const archive: ImportArchiveLifecycle | undefined = item.role === "archive"
      ? { state: "expanding", inventoryDurable: false, expectedChildren: 0, discoveredChildren: 0, terminalChildren: 0, reviewCount: 0, reviewEntries: [] }
      : undefined;
    tx.set(ref, {
      ...item, contentHash: item.sha256, reasonCode: item.reasonCode,
      action: persistedAction(item.action), reason: persistedReason(item.reasonCode),
      state: "discovered", attempts: 0, createdAt: now, updatedAt: now, ...(archive ? { archive } : {}),
    });
    const data = batchSnap.data() as { counters: Record<string, number> };
    tx.update(batch, {
      counters: { ...data.counters, discoveredItems: data.counters.discoveredItems + 1 }, updatedAt: now,
    });
    if (parent?.exists && parentId) {
      const parentArchive = parent.data()?.archive as ImportArchiveLifecycle | undefined;
      if (parentArchive) tx.update(importItemRef(db, item.ownerId, item.batchId, parentId), {
        archive: { ...parentArchive, discoveredChildren: parentArchive.discoveredChildren + 1 }, updatedAt: now,
      });
    }
    return { kind: "created", itemId: item.itemId };
  });
}
export { completeArchiveIfReady, markArchiveInventoryDurableOnce, markItemTerminalOnce } from "./archiveLifecycleStore";
export type { ArchiveLifecycleResult } from "./archiveLifecycleStore";
