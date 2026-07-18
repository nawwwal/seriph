import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ImportItemAction, ImportItemReason } from "../contracts/item";
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
const persistedReason = (reasonCode: string): ImportItemReason | "disposable_name" => {
  const allowed: Array<ImportItemReason | "disposable_name"> = [
    "detected_font", "source_asset", "documentation", "web_asset", "archive_container",
    "unsupported_content", "ambiguous_identity", "unsafe_archive", "duplicate_content", "disposable_name",
  ];
  return allowed.includes(reasonCode as ImportItemReason | "disposable_name") ?
    reasonCode as ImportItemReason | "disposable_name" : "unsupported_content";
};

export async function createItemOnce(db: Firestore, item: InventoryItem): Promise<CreateItemResult> {
  return db.runTransaction(async (tx) => {
    const batch = importBatchRef(db, item.ownerId, item.batchId);
    const ref = importItemRef(db, item.ownerId, item.batchId, item.itemId);
    const batchSnap = await tx.get(batch);
    const current = await tx.get(ref);
    if (current.exists) return { kind: "exists", itemId: item.itemId };
    if (!batchSnap.exists) return { kind: "batch_missing", itemId: item.itemId };
    const now = FieldValue.serverTimestamp() as unknown as string;
    tx.set(ref, {
      ...item, contentHash: item.sha256, reasonCode: item.reasonCode,
      action: persistedAction(item.action), reason: persistedReason(item.reasonCode),
      state: "discovered", attempts: 0, createdAt: now, updatedAt: now,
    });
    const data = batchSnap.data() as { counters: Record<string, number> };
    tx.update(batch, {
      counters: { ...data.counters, discoveredItems: data.counters.discoveredItems + 1 }, updatedAt: now,
    });
    return { kind: "created", itemId: item.itemId };
  });
}
