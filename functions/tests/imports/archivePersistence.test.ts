import { describe, expect, it, vi } from "vitest";
import { buildInventoryItem } from "../../src/imports/discovery/inventory";
import { persistArchiveDiscovery } from "../../src/imports/discovery/discoverZip";
import { createBatch } from "../../src/imports/store/batchStore";
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

it("propagates nested archive completion to its parent", async () => {
  const db = new Db(); await createBatch(db, { ownerId: "ada", batchId: "b1", label: "x", expectedSourceCount: 1 });
  const outer = await buildInventoryItem({ ...base, bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
  const nested = await buildInventoryItem({ ...base, archiveLineage: [{ archiveItemId: outer.itemId, entryPath: "nested.zip" }], filename: "nested.zip", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]), name: "nested.zip" });
  const leaf = await buildInventoryItem({ ...base, archiveLineage: [{ archiveItemId: outer.itemId, entryPath: "nested.zip" }, { archiveItemId: nested.itemId, entryPath: "font.ttf" }], filename: "font.ttf", extension: ".ttf", bytes: Buffer.from([0, 1, 0, 0]), name: "font.ttf" });
  await createItemOnce(db, outer); await createItemOnce(db, nested); await createItemOnce(db, leaf);
  await markArchiveInventoryDurableOnce(db, { ownerId: "ada", batchId: "b1", itemId: outer.itemId, expectedChildren: 1, reviewCount: 0 });
  await markArchiveInventoryDurableOnce(db, { ownerId: "ada", batchId: "b1", itemId: nested.itemId, expectedChildren: 1, reviewCount: 0 });
  await markItemTerminalOnce(db, { ownerId: "ada", batchId: "b1", itemId: leaf.itemId }, "classified");
  expect((db.docs.get(importItemRef(db, "ada", "b1", nested.itemId).path)!.archive as Data).state).toBe("complete");
  expect((db.docs.get(importItemRef(db, "ada", "b1", outer.itemId).path)!.archive as Data).state).toBe("complete");
});
