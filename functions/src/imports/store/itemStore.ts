import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ImportArchiveLifecycle, ImportItemAction, ImportItemReason, ImportItemState } from "../contracts/item";
import { importBatchRef } from "./paths";
import type { InventoryItem } from "../discovery/inventory";

const itemSegment = (value: string): string => {
  if (!value || value.includes("/")) throw new Error("invalid itemId");
  return value;
};

export const importItemRef = (db: Firestore, ownerId: string, batchId: string, itemId: string) =>
  importBatchRef(db, ownerId, batchId).collection("items").doc(itemSegment(itemId));

export type CreateItemResult = { kind: "created" | "exists" | "batch_missing"; itemId: string };
export type ArchiveLifecycleResult = { kind: "updated" | "exists" | "missing" | "not_archive" | "waiting" | "completed" };

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
      ? { state: "expanding", inventoryDurable: false, expectedChildren: 0, discoveredChildren: 0, terminalChildren: 0, reviewCount: 0 }
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

const terminal = new Set<ImportItemState>(["classified", "applied", "duplicate", "review", "discarded", "failed"]); const archiveDone = (archive: ImportArchiveLifecycle): ImportArchiveLifecycle["state"] =>
  archive.reviewCount > 0 ? "review" : "complete";

export async function markArchiveInventoryDurableOnce(db: Firestore, input: { ownerId: string; batchId: string; itemId: string; expectedChildren: number; reviewCount: number }): Promise<ArchiveLifecycleResult> {
  return db.runTransaction(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const current = snap.data()!; const archive = current.archive as ImportArchiveLifecycle | undefined;
    if (!archive) return { kind: "not_archive" }; if (archive.inventoryDurable) return { kind: "exists" };
    const next = { ...archive, inventoryDurable: true, expectedChildren: input.expectedChildren, reviewCount: input.reviewCount }; const now = FieldValue.serverTimestamp() as unknown as string;
    tx.update(ref, { archive: next, updatedAt: now }); return { kind: "updated" };
  });
}

export async function markItemTerminalOnce(db: Firestore, input: { ownerId: string; batchId: string; itemId: string }, state: ImportItemState): Promise<ArchiveLifecycleResult> {
  if (!terminal.has(state)) throw new Error("item state is not terminal");
  let parentId: string | undefined; const result = await db.runTransaction<ArchiveLifecycleResult>(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const current = snap.data() as Record<string, any>;
    if (terminal.has(current.state as ImportItemState)) return { kind: "exists" };
    parentId = (current.archiveLineage as Array<{ archiveItemId: string }> | undefined)?.at(-1)?.archiveItemId;
    const parentRef = parentId ? importItemRef(db, input.ownerId, input.batchId, parentId) : undefined;
    const parent = parentRef ? await tx.get(parentRef) : undefined; const now = FieldValue.serverTimestamp() as unknown as string;
    tx.update(ref, { state, updatedAt: now });
    if (parent?.exists && parentRef) {
      const archive = parent.data()?.archive as ImportArchiveLifecycle | undefined;
      if (archive) { const next = { ...archive, terminalChildren: archive.terminalChildren + 1 };
        tx.update(parentRef, { archive: next, state: parent.data()?.state, updatedAt: now }); }
    }
    return { kind: "updated" };
  });
  if (result.kind === "updated" && parentId) await completeArchiveIfReady(db, { ownerId: input.ownerId, batchId: input.batchId, itemId: parentId });
  return result;
}

export async function completeArchiveIfReady(db: Firestore, input: { ownerId: string; batchId: string; itemId: string }): Promise<ArchiveLifecycleResult> {
  return db.runTransaction(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const current = snap.data()!; const archive = current.archive as ImportArchiveLifecycle | undefined;
    if (!archive) return { kind: "not_archive" }; if (!archive.inventoryDurable || archive.terminalChildren < archive.expectedChildren) return { kind: "waiting" };
    const state = archiveDone(archive); if (archive.state === state) return { kind: "completed" }; const now = FieldValue.serverTimestamp() as unknown as string;
    const parentId = (current.archiveLineage as Array<{ archiveItemId: string }> | undefined)?.at(-1)?.archiveItemId;
    const parentRef = parentId ? importItemRef(db, input.ownerId, input.batchId, parentId) : undefined;
    const parent = parentRef ? await tx.get(parentRef) : undefined;
    tx.update(ref, { archive: { ...archive, state }, state: state === "review" ? "review" : "classified", updatedAt: now });
    if (parent?.exists && parentRef) { const parentArchive = parent.data()?.archive as ImportArchiveLifecycle | undefined;
      if (parentArchive) { const next = { ...parentArchive, terminalChildren: parentArchive.terminalChildren + 1 }; const done = next.inventoryDurable && next.terminalChildren >= next.expectedChildren;
        tx.update(parentRef, { archive: { ...next, state: done ? archiveDone(next) : next.state }, state: done ? archiveDone(next) === "review" ? "review" : "classified" : parent.data()?.state, updatedAt: now }); } }
    return { kind: "completed" };
  });
}
