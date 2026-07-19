import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { inspectArchive } from "../../src/imports/discovery/discoverZip";
import { discoverZip } from "../../src/imports/discovery/discoverZip";
import { extractEntryBounded } from "../../src/imports/discovery/discoverZip";
import { assessArchiveEntry } from "../../src/imports/discovery/archivePolicy";
import { importTaskStages, registerImportStage } from "../../src/imports/tasks/dispatch";

const limits = {
  maxDepth: 4, maxEntries: 10000, maxExpandedBatchBytes: 2_147_483_648,
  maxEntryBytes: 268_435_456, maxCompressionRatio: 100, maxPathBytes: 1024,
};
const provenance = {
  ownerId: "ada", batchId: "batch-1", sourceId: "source-1", originalPath: "inbox.zip",
  archiveLineage: [], filename: "inbox.zip", extension: ".zip", declaredMimeType: "application/zip",
};

async function fixtureZip(entries: Record<string, string | Uint8Array>) {
  const zip = new JSZip();
  for (const [name, bytes] of Object.entries(entries)) zip.file(name, bytes);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

describe("safe ZIP discovery", () => {
  it.each([
    ["../escape.otf", "path_traversal"], ["/absolute.ttf", "absolute_path"],
    ["..\\escape.ttf", "path_traversal"],
    ["C:foo.ttf", "absolute_path"], ["c:/foo.ttf", "absolute_path"], ["C:\\foo.ttf", "absolute_path"],
  ])("quarantines unsafe entry %s", async (entryPath, reasonCode) => {
    const result = await inspectArchive(await fixtureZip({ [entryPath]: "font" }), limits);
    expect(result).toContainEqual(expect.objectContaining({ action: "review", reasonCode }));
  });

  it("rejects encrypted, symlink, unsupported, and quota-breaking entries", async () => {
    const zip = await fixtureZip({ "ok.ttf": "font" });
    const metadata = { entryPath: "ok.ttf", flags: 0, compressionMethod: 0, compressedSize: 10, uncompressedSize: 10 };
    expect(assessArchiveEntry({ ...metadata, flags: 1 }, limits).reasonCode).toBe("encrypted_entry");
    expect(assessArchiveEntry({ ...metadata, compressionMethod: 12 }, limits).reasonCode).toBe("unsupported_entry");
    expect(assessArchiveEntry({ ...metadata, versionMadeBy: 3 << 8, externalFileAttributes: 0xa000 << 16 }, limits).reasonCode)
      .toBe("symlink_entry");
    expect(assessArchiveEntry({ ...metadata, uncompressedSize: 999 }, { ...limits, maxEntryBytes: 100 }).reasonCode).toBe("entry_size");
    expect(assessArchiveEntry(metadata, { ...limits, maxExpandedBatchBytes: 10 }, 1).reasonCode).toBe("expanded_size");
    expect(assessArchiveEntry({ ...metadata, entryPath: "x".repeat(10) }, { ...limits, maxPathBytes: 2 }).reasonCode).toBe("path_length");
    expect(await inspectArchive(zip, { ...limits, maxEntries: 0 }))
      .toContainEqual(expect.objectContaining({ action: "review", reasonCode: "entry_limit" }));
    expect(await inspectArchive(zip, { ...limits, maxDepth: 0 }, 1))
      .toContainEqual(expect.objectContaining({ action: "review", reasonCode: "max_depth" }));
    expect(await inspectArchive(await fixtureZip({ "ok.ttf": "x".repeat(10000) }), {
      ...limits, maxCompressionRatio: 2,
    })).toContainEqual(expect.objectContaining({ action: "review", reasonCode: "compression_ratio" }));
  });

  it("rejects Unicode-normalized path collisions", async () => {
    const result = await inspectArchive(await fixtureZip({ "ｅ.ttf": "font", "e.ttf": "font" }), limits);
    expect(result).toContainEqual(expect.objectContaining({ action: "review", reasonCode: "path_collision" }));
  });

  it("bounds streaming extraction before allocating an oversized result", async () => {
    let chunksRead = 0;
    const entry = {
      path: "large.ttf",
      stream: () => (async function* () {
        chunksRead += 1; yield Buffer.alloc(8); chunksRead += 1; yield Buffer.alloc(8);
        chunksRead += 1; yield Buffer.alloc(8);
      })(),
    };
    await expect(extractEntryBounded(entry, 10, 1000, 0)).resolves.toMatchObject({
      action: "review", reasonCode: "entry_size", entryPath: "large.ttf",
    });
    expect(chunksRead).toBeLessThan(3);
  });

  it("turns corrupt deflate streams into review decisions", async () => {
    const entry = {
      path: "corrupt.ttf",
      stream: () => (async function* () { throw new Error("invalid distance too far back"); })(),
    };
    await expect(extractEntryBounded(entry, 100, 0)).resolves.toMatchObject({
      action: "review", reasonCode: "decompression_failure", entryPath: "corrupt.ttf",
    });
  });

  it("creates deterministic child inventory, staging paths, and nested tasks", async () => {
    const bytes = await fixtureZip({ "fonts/ok.ttf": Buffer.from([0, 1, 0, 0]), "nested.zip": await fixtureZip({ "inner.otf": "font" }) });
    const first = await discoverZip({ ...provenance, archiveItemId: "item-archive", bytes, limits });
    const second = await discoverZip({ ...provenance, archiveItemId: "item-archive", bytes, limits });
    expect(first.reviews).toEqual([]);
    expect(first.children.map((child) => child.staging.path)).toEqual([
      "import_staging/ada/batch-1/item-archive/fonts/ok.ttf",
      "import_staging/ada/batch-1/item-archive/nested.zip",
    ]);
    expect(first.children.map((child) => child.task)).toEqual(second.children.map((child) => child.task));
    expect(first.children[0].inventory.archiveLineage).toEqual([{ archiveItemId: "item-archive", entryPath: "fonts/ok.ttf" }]);
    expect(first.children[1].inventory.role).toBe("archive");
    expect(first.children.every((child) => child.task.kind === "discover_item")).toBe(true);
    expect(first.children.every((child) => child.task.archiveBudgetKey === provenance.batchId)).toBe(true);
  });

  it("registers production discovery and planning stages", () => {
    expect(importTaskStages.discover_source).toBeTypeOf("function");
    expect(importTaskStages.discover_item).toBeTypeOf("function");
    expect(importTaskStages.finalize_plan).toBeTypeOf("function");
    const handler = async () => ({ status: 204 as const });
    registerImportStage("discover_item", handler);
    expect(importTaskStages.discover_item).toBe(handler);
  });
});
