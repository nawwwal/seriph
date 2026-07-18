import { describe, expect, it, vi } from "vitest";
import { buildInventoryItem } from "../../src/imports/discovery/inventory";
import { persistArchiveDiscovery } from "../../src/imports/discovery/discoverZip";
import { createBatch, reserveArchiveBytesOnce } from "../../src/imports/store/batchStore";
import { completeArchiveIfReady, createItemOnce, importItemRef, markArchiveInventoryDurableOnce, markItemTerminalOnce } from "../../src/imports/store/itemStore";

type Data = Record<string, any>;
class Ref { constructor(readonly path: string, private db: Db) {} collection = (id: string) => ({ doc: (key: string) => new Ref(`${this.path}/${id}/${key}`, this.db) }); get = async () => ({ exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }); }
class Tx { private wrote = false; constructor(private db: Db) {} get = (ref: Ref) => { if (this.wrote) throw new Error("read after write"); return ref.get(); }; set = (ref: Ref, data: Data) => { this.wrote = true; this.db.docs.set(ref.path, { ...data }); }; update = (ref: Ref, data: Data) => { this.wrote = true; this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); }; }
class Db { docs = new Map<string, Data>(); collection = (id: string) => ({ doc: (key: string) => new Ref(`${id}/${key}`, this) }); runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => fn(new Tx(this)); }

const limits = { maxDepth: 4, maxEntries: 100, maxExpandedBatchBytes: 1000, maxEntryBytes: 100, maxCompressionRatio: 100, maxPathBytes: 1024 };
const base = { ownerId: "ada", batchId: "b1", sourceId: "s1", originalPath: "inbox.zip", archiveLineage: [], filename: "inbox.zip", extension: ".zip", declaredMimeType: "application/zip" };

it("persists child inventory/staging/tasks once and completes only after terminal redelivery", async () => {
  const db = new Db(); await createBatch(db, { ownerId: "ada", batchId: "b1", label: "x", expectedSourceCount: 1 });
  const archive = await buildInventoryItem({ ...base, bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
  await createItemOnce(db, archive);
  const child = await buildInventoryItem({ ...base, filename: "font.ttf", extension: ".ttf", archiveLineage: [{ archiveItemId: archive.itemId, entryPath: "font.ttf" }], bytes: Buffer.from([0, 1, 0, 0]), name: "font.ttf" });
  const stage = vi.fn().mockResolvedValue(undefined); const enqueue = vi.fn().mockResolvedValue("created");
  const discovery = { reviews: [], children: [{ inventory: child, staging: { path: "import_staging/ada/b1/archive/font.ttf", bytes: Buffer.from("font"), contentHash: child.sha256 }, task: { kind: "discover_item" as const, ownerId: "ada", batchId: "b1", resourceId: child.itemId, planVersion: 1 } }] };
  await persistArchiveDiscovery(db, archive.itemId, discovery, { stage, enqueue });
  await persistArchiveDiscovery(db, archive.itemId, discovery, { stage, enqueue });
  expect((db.docs.get("users/ada/importBatches/b1")!.counters as Data).discoveredItems).toBe(2);
  expect(db.docs.get(importItemRef(db, "ada", "b1", child.itemId).path)).toBeTruthy();
  expect((db.docs.get(importItemRef(db, "ada", "b1", archive.itemId).path)!.archive as Data).terminalChildren).toBe(0);
  await expect(completeArchiveIfReady(db, { ownerId: "ada", batchId: "b1", itemId: archive.itemId })).resolves.toMatchObject({ kind: "waiting" });
  await markItemTerminalOnce(db, { ownerId: "ada", batchId: "b1", itemId: child.itemId }, "classified");
  await markItemTerminalOnce(db, { ownerId: "ada", batchId: "b1", itemId: child.itemId }, "classified");
  await expect(completeArchiveIfReady(db, { ownerId: "ada", batchId: "b1", itemId: archive.itemId })).resolves.toMatchObject({ kind: "completed" });
  expect((db.docs.get(importItemRef(db, "ada", "b1", archive.itemId).path)!.archive as Data).terminalChildren).toBe(1);
  expect((db.docs.get(importItemRef(db, "ada", "b1", archive.itemId).path)!.archive as Data).state).toBe("complete");
});

it("reserves one shared archive budget atomically across redelivery and nesting", async () => {
  const db = new Db(); await createBatch(db, { ownerId: "ada", batchId: "b1", label: "x", expectedSourceCount: 1 });
  await expect(reserveArchiveBytesOnce(db, { ownerId: "ada", batchId: "b1", reservationId: "outer/font.ttf", bytes: 80, maxBytes: 100 })).resolves.toMatchObject({ kind: "reserved", reservedBytes: 80, remainingBytes: 20 });
  await expect(reserveArchiveBytesOnce(db, { ownerId: "ada", batchId: "b1", reservationId: "outer/font.ttf", bytes: 80, maxBytes: 100 })).resolves.toMatchObject({ kind: "exists", reservedBytes: 80 });
  await expect(reserveArchiveBytesOnce(db, { ownerId: "ada", batchId: "b1", reservationId: "nested/inner.ttf", bytes: 30, maxBytes: 100 })).resolves.toMatchObject({ kind: "exceeded", reservedBytes: 80, remainingBytes: 20 });
});

it("persists structured archive reviews with durable path and lineage", async () => {
  const db = new Db(); await createBatch(db, { ownerId: "ada", batchId: "b1", label: "x", expectedSourceCount: 1 });
  const archive = await buildInventoryItem({ ...base, bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }); await createItemOnce(db, archive);
  const lineage = [{ archiveItemId: archive.itemId, entryPath: "ｅ.ttf" }];
  await persistArchiveDiscovery(db, archive.itemId, { children: [], reviews: [
    { action: "review", reasonCode: "path_collision", entryPath: "ｅ.ttf", parentItemId: archive.itemId, lineage },
    { action: "review", reasonCode: "decompression_failure", entryPath: "bad.ttf", parentItemId: archive.itemId, lineage: [{ archiveItemId: archive.itemId, entryPath: "bad.ttf" }] },
  ] }, { stage: vi.fn(), enqueue: vi.fn(), ownerId: "ada", batchId: "b1" });
  expect((db.docs.get(importItemRef(db, "ada", "b1", archive.itemId).path)!.archive as Data).reviewEntries).toEqual([
    { path: "ｅ.ttf", reasonCode: "path_collision", parentItemId: archive.itemId, lineage },
    { path: "bad.ttf", reasonCode: "decompression_failure", parentItemId: archive.itemId, lineage: [{ archiveItemId: archive.itemId, entryPath: "bad.ttf" }] },
  ]);
});

it("propagates nested archive completion through three ancestors", async () => {
  const db = new Db(); await createBatch(db, { ownerId: "ada", batchId: "b1", label: "x", expectedSourceCount: 1 });
  const outer = await buildInventoryItem({ ...base, bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
  const middle = await buildInventoryItem({ ...base, archiveLineage: [{ archiveItemId: outer.itemId, entryPath: "middle.zip" }], filename: "middle.zip", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]), name: "middle.zip" });
  const inner = await buildInventoryItem({ ...base, archiveLineage: [{ archiveItemId: outer.itemId, entryPath: "middle.zip" }, { archiveItemId: middle.itemId, entryPath: "inner.zip" }], filename: "inner.zip", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]), name: "inner.zip" });
  const leaf = await buildInventoryItem({ ...base, archiveLineage: [{ archiveItemId: outer.itemId, entryPath: "middle.zip" }, { archiveItemId: middle.itemId, entryPath: "inner.zip" }, { archiveItemId: inner.itemId, entryPath: "font.ttf" }], filename: "font.ttf", extension: ".ttf", bytes: Buffer.from([0, 1, 0, 0]), name: "font.ttf" });
  await createItemOnce(db, outer); await createItemOnce(db, middle); await createItemOnce(db, inner); await createItemOnce(db, leaf);
  await markArchiveInventoryDurableOnce(db, { ownerId: "ada", batchId: "b1", itemId: outer.itemId, expectedChildren: 1, reviewCount: 0 });
  await markArchiveInventoryDurableOnce(db, { ownerId: "ada", batchId: "b1", itemId: middle.itemId, expectedChildren: 1, reviewCount: 0 });
  await markArchiveInventoryDurableOnce(db, { ownerId: "ada", batchId: "b1", itemId: inner.itemId, expectedChildren: 1, reviewCount: 0 });
  await markItemTerminalOnce(db, { ownerId: "ada", batchId: "b1", itemId: leaf.itemId }, "classified");
  expect((db.docs.get(importItemRef(db, "ada", "b1", inner.itemId).path)!.archive as Data).state).toBe("complete");
  expect((db.docs.get(importItemRef(db, "ada", "b1", middle.itemId).path)!.archive as Data).state).toBe("complete");
  expect(db.docs.get(importItemRef(db, "ada", "b1", outer.itemId).path)!.archive as Data).toMatchObject({ terminalChildren: 1, inventoryDurable: true });
  expect((db.docs.get(importItemRef(db, "ada", "b1", outer.itemId).path)!.archive as Data).state).toBe("complete");
});
