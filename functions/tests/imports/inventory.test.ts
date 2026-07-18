import { describe, expect, it } from "vitest";
import { createBatch } from "../../src/imports/store/batchStore";
import { createItemOnce, importItemRef } from "../../src/imports/store/itemStore";
import { buildInventoryItem } from "../../src/imports/discovery/inventory";
import { classifyInventoryItem } from "../../src/imports/discovery/classifyRole";
import type { ImportItemReason } from "../../src/imports/contracts/item";

type Data = Record<string, unknown>;

class FakeRef {
  constructor(readonly path: string, private readonly db: FakeDb) {}
  collection(id: string) {
    return { doc: (key: string) => new FakeRef(`${this.path}/${id}/${key}`, this.db) };
  }
  async get() {
    return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) };
  }
}

class FakeTx {
  private wrote = false;
  constructor(private readonly db: FakeDb) {}
  get = (ref: FakeRef) => {
    if (this.wrote) throw new Error("transaction read after write");
    return ref.get();
  };
  set = (ref: FakeRef, data: Data) => {
    this.wrote = true;
    this.db.docs.set(ref.path, { ...data });
    this.db.writes.push([ref.path, data]);
  };
  update = (ref: FakeRef, data: Data) => {
    this.wrote = true;
    this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
    this.db.writes.push([ref.path, data]);
  };
}

class FakeDb {
  docs = new Map<string, Data>();
  writes: [string, Data][] = [];
  collection = (id: string) => ({ doc: (key: string) => new FakeRef(`${id}/${key}`, this) });
  runTransaction = async <T>(run: (tx: FakeTx) => Promise<T>) => run(new FakeTx(this));
}

const batch = { ownerId: "ada", batchId: "batch-1", label: "July", expectedSourceCount: 1 };
const provenance = {
  ownerId: "ada",
  batchId: "batch-1",
  sourceId: "source-1",
  originalPath: "/inbox/font.bin",
  archiveLineage: [],
  filename: "font.bin",
  extension: ".bin",
  declaredMimeType: "application/octet-stream",
};

async function* chunks(...values: Uint8Array[]) {
  for (const value of values) yield value;
}

function representativeEot(): Buffer {
  const eot = Buffer.alloc(100);
  eot.writeUInt32LE(100, 0);
  eot.writeUInt32LE(4, 4);
  eot.writeUInt32LE(0x00010000, 8);
  eot.writeUInt16LE(0, 32);
  eot.writeUInt16LE(0x504c, 34);
  eot.writeUInt16LE(0, 80);
  eot.writeUInt16LE(0, 82);
  eot.writeUInt16LE(0, 84);
  eot.writeUInt16LE(0, 86);
  eot.writeUInt16LE(0, 88);
  eot.writeUInt16LE(0, 90);
  eot.writeUInt16LE(0, 92);
  eot.writeUInt16LE(0, 94);
  eot.write("font", 96, "ascii");
  return eot;
}

describe("inventory content discovery", () => {
  it.each([
    [Buffer.from([0, 1, 0, 0]), "TTF", "font"],
    [Buffer.from("wOF2xxxx"), "WOFF2", "font"],
    [Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x61, 0x72, 0x63, 0x68, 0x69, 0x76, 0x65]), "ZIP", "archive"],
    [Buffer.from("/* Glyphs */\nfontMaster = ();"), "GLYPHS", "source"],
    [Buffer.from("Bud1"), "UNKNOWN", "junk"],
  ] as const)("detects bytes before extension", (bytes, format, role) => {
    expect(classifyInventoryItem({ bytes, name: "misleading.bin" })).toMatchObject({ format, role });
  });

  it("detects a structurally valid EOT header rather than a fixed prefix", () => {
    expect(classifyInventoryItem({ bytes: representativeEot(), name: "misleading.bin" })).toMatchObject({
      format: "EOT", detectedFormat: "EOT", role: "font", action: "parse",
    });
    expect(classifyInventoryItem({ bytes: Buffer.from([0, 0, 1, 0, 0, 0, 0, 0]), name: "misleading.bin" }).format)
      .toBe("UNKNOWN");
  });

  it("keeps unknown content reviewable and preserves the declared extension", async () => {
    const item = await buildInventoryItem({
      ...provenance,
      bytes: chunks(Buffer.from("not a supported file")),
      name: "README.md",
    });

    expect(item).toMatchObject({ detectedFormat: "UNKNOWN", role: "documentation", action: "retain_private" });
    expect(item.extension).toBe(".bin");
    expect(item.reasonCode).toBe("documentation");
  });

  it("sends unsupported non-disposable content to review", () => {
    expect(classifyInventoryItem({ bytes: Buffer.from("opaque"), name: "mystery.bin" })).toMatchObject({
      format: "UNKNOWN", role: "unresolved", action: "review", reasonCode: "unsupported_content",
    });
  });

  it("retains documentation only when unknown content is positively safe text", async () => {
    const text = await buildInventoryItem({
      ...provenance,
      bytes: chunks(Buffer.from("# README\nThis is documentation.\n")),
      name: "README.md",
    });
    const binary = await buildInventoryItem({
      ...provenance,
      bytes: chunks(Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff])),
      name: "README.md",
    });

    expect(text).toMatchObject({ role: "documentation", action: "retain_private", reasonCode: "documentation" });
    expect(binary).toMatchObject({ role: "unresolved", action: "review", reasonCode: "unsupported_content" });
  });

  it("rejects a documentation prefix followed by a binary tail", async () => {
    const longTextPrefix = Buffer.from("# README\nThis remains safe text.\n".repeat(200));
    expect(longTextPrefix.byteLength).toBeGreaterThan(4096);
    const item = await buildInventoryItem({
      ...provenance,
      bytes: chunks(longTextPrefix, Buffer.from([0x00, 0xff])),
      name: "README.md",
    });

    expect(item).toMatchObject({ role: "unresolved", action: "review", reasonCode: "unsupported_content" });
  });

  it("requires byte-recognized web content instead of trusting a web extension", async () => {
    const binary = await buildInventoryItem({
      ...provenance,
      bytes: chunks(Buffer.from([0x00, 0x01, 0xff])),
      name: "style.css",
    });
    const css = await buildInventoryItem({
      ...provenance,
      bytes: chunks(Buffer.from("body { color: red; }")),
      name: "style.css",
    });

    expect(binary).toMatchObject({ role: "unresolved", action: "review", reasonCode: "unsupported_content" });
    expect(css).toMatchObject({ role: "web", action: "retain_private", reasonCode: "web_asset" });
  });

  it("includes disposable_name in the ImportItemReason type contract", () => {
    const reason: ImportItemReason = "disposable_name";
    expect(reason).toBe("disposable_name");
  });

  it("uses exact disposable names without discarding similarly named files", () => {
    expect(classifyInventoryItem({ bytes: Buffer.from("opaque"), name: ".DS_Store" })).toMatchObject({
      role: "junk", action: "discard", reasonCode: "disposable_name",
    });
    expect(classifyInventoryItem({ bytes: Buffer.from("opaque"), name: "archive.DS_Store" })).toMatchObject({
      role: "unresolved", action: "review",
    });
  });

  it("hashes every stream chunk and gives equivalent content a stable item id", async () => {
    const first = await buildInventoryItem({ ...provenance, bytes: chunks(Buffer.from("font"), Buffer.from("data")) });
    const second = await buildInventoryItem({ ...provenance, bytes: chunks(Buffer.from("fontdata")) });

    expect(first.sha256).toBe("2f4e57c90c23ad02949980b67d16babfddf066140200e628807e004cee0ddcda");
    expect(second.sha256).toBe(first.sha256);
    expect(second.itemId).toBe(first.itemId);
    expect(second.itemId).not.toBe((await buildInventoryItem({
      ...provenance, sourceId: "source-2", bytes: chunks(Buffer.from("fontdata")),
    })).itemId);
  });

  it("persists provenance once and increments discovery fan-out once", async () => {
    const db = new FakeDb();
    await createBatch(db, batch);
    const item = await buildInventoryItem({ ...provenance, bytes: chunks(Buffer.from("fontdata")) });

    await expect(createItemOnce(db, item)).resolves.toEqual({ kind: "created", itemId: item.itemId });
    await expect(createItemOnce(db, item)).resolves.toEqual({ kind: "exists", itemId: item.itemId });

    expect(db.docs.get(importItemRef(db, batch.ownerId, batch.batchId, item.itemId).path)).toMatchObject({
      itemId: item.itemId,
      sourceId: provenance.sourceId,
      originalPath: provenance.originalPath,
      contentHash: item.sha256,
    });
    expect((db.docs.get("users/ada/importBatches/batch-1")!.counters as Data).discoveredItems).toBe(1);
    expect(db.writes.filter(([path]) => path.includes("/items/")).length).toBe(1);
  });

  it("persists the canonical disposable reason and all classification provenance once", async () => {
    const db = new FakeDb();
    await createBatch(db, batch);
    const item = await buildInventoryItem({
      ...provenance,
      filename: ".DS_Store",
      extension: "",
      bytes: chunks(Buffer.from("Bud1")),
      name: ".DS_Store",
    });

    await expect(createItemOnce(db, item)).resolves.toEqual({ kind: "created", itemId: item.itemId });
    await expect(createItemOnce(db, item)).resolves.toEqual({ kind: "exists", itemId: item.itemId });

    const persisted = db.docs.get(importItemRef(db, batch.ownerId, batch.batchId, item.itemId).path)!;
    expect(persisted).toMatchObject({
      role: "junk", action: "discard", reason: "disposable_name", reasonCode: "disposable_name",
      detectedFormat: "UNKNOWN", sourceId: provenance.sourceId, originalPath: provenance.originalPath,
      filename: ".DS_Store", extension: "", declaredMimeType: provenance.declaredMimeType,
    });
    expect((db.docs.get("users/ada/importBatches/batch-1")!.counters as Data).discoveredItems).toBe(1);
    expect(db.writes.filter(([path]) => path.includes("/items/")).length).toBe(1);
  });
});
