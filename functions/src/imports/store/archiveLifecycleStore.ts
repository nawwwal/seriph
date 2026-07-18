import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ImportArchiveLifecycle, ImportArchiveReview, ImportItemState } from "../contracts/item";
import { importItemRef } from "./itemStore";

export type ArchiveLifecycleResult = { kind: "updated" | "exists" | "missing" | "not_archive" | "waiting" | "completed" };
const terminal = new Set<ImportItemState>(["classified", "applied", "duplicate", "review", "discarded", "failed"]);
const archiveDone = (archive: ImportArchiveLifecycle): ImportArchiveLifecycle["state"] => archive.reviewCount > 0 ? "review" : "complete";

export async function markArchiveInventoryDurableOnce(db: Firestore, input: { ownerId: string; batchId: string; itemId: string; expectedChildren: number; reviewCount?: number; reviewEntries?: ImportArchiveReview[] }): Promise<ArchiveLifecycleResult> {
  return db.runTransaction(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const archive = snap.data()!.archive as ImportArchiveLifecycle | undefined;
    if (!archive) return { kind: "not_archive" }; if (archive.inventoryDurable) return { kind: "exists" };
    const entries = input.reviewEntries ?? []; const next = { ...archive, inventoryDurable: true, expectedChildren: input.expectedChildren, reviewCount: input.reviewEntries ? entries.length : input.reviewCount ?? 0, reviewEntries: entries };
    tx.update(ref, { archive: next, updatedAt: FieldValue.serverTimestamp() }); return { kind: "updated" };
  });
}

export async function markItemTerminalOnce(db: Firestore, input: { ownerId: string; batchId: string; itemId: string }, state: ImportItemState): Promise<ArchiveLifecycleResult> {
  if (!terminal.has(state)) throw new Error("item state is not terminal");
  let parentId: string | undefined; const result = await db.runTransaction<ArchiveLifecycleResult>(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const current = snap.data() as Record<string, any>;
    if (terminal.has(current.state as ImportItemState)) return { kind: "exists" };
    parentId = (current.archiveLineage as Array<{ archiveItemId: string }> | undefined)?.at(-1)?.archiveItemId;
    const parentRef = parentId ? importItemRef(db, input.ownerId, input.batchId, parentId) : undefined; const parent = parentRef ? await tx.get(parentRef) : undefined;
    tx.update(ref, { state, updatedAt: FieldValue.serverTimestamp() });
    if (parent?.exists && parentRef) { const archive = parent.data()?.archive as ImportArchiveLifecycle | undefined;
      if (archive) tx.update(parentRef, { archive: { ...archive, terminalChildren: archive.terminalChildren + 1 }, updatedAt: FieldValue.serverTimestamp() }); }
    return { kind: "updated" };
  });
  if (result.kind === "updated" && parentId) await completeArchiveIfReady(db, { ownerId: input.ownerId, batchId: input.batchId, itemId: parentId });
  return result;
}

export async function completeArchiveIfReady(db: Firestore, input: { ownerId: string; batchId: string; itemId: string }): Promise<ArchiveLifecycleResult> {
  let propagateParentId: string | undefined;
  const result = await db.runTransaction<ArchiveLifecycleResult>(async (tx) => {
    const ref = importItemRef(db, input.ownerId, input.batchId, input.itemId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" }; const current = snap.data()!; const archive = current.archive as ImportArchiveLifecycle | undefined;
    if (!archive) return { kind: "not_archive" }; if (!archive.inventoryDurable || archive.terminalChildren < archive.expectedChildren) return { kind: "waiting" };
    const state = archiveDone(archive); if (archive.state === state) return { kind: "completed" }; const now = FieldValue.serverTimestamp() as unknown as string;
    const parentId = (current.archiveLineage as Array<{ archiveItemId: string }> | undefined)?.at(-1)?.archiveItemId;
    const parentRef = parentId ? importItemRef(db, input.ownerId, input.batchId, parentId) : undefined; const parent = parentRef ? await tx.get(parentRef) : undefined;
    tx.update(ref, { archive: { ...archive, state }, state: state === "review" ? "review" : "classified", updatedAt: now }); propagateParentId = parentId;
    if (parent?.exists && parentRef) { const parentArchive = parent.data()?.archive as ImportArchiveLifecycle | undefined;
      if (parentArchive) tx.update(parentRef, { archive: { ...parentArchive, terminalChildren: parentArchive.terminalChildren + 1 }, updatedAt: now }); }
    return { kind: "completed" };
  });
  if (result.kind === "completed" && propagateParentId) await completeArchiveIfReady(db, { ownerId: input.ownerId, batchId: input.batchId, itemId: propagateParentId });
  return result;
}
