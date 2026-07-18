import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { discoverZip } from "../../src/imports/discovery/discoverZip";

const limits = { maxDepth: 4, maxEntries: 100, maxExpandedBatchBytes: 1000, maxEntryBytes: 100, maxCompressionRatio: 100, maxPathBytes: 1024 };
const base = { ownerId: "ada", batchId: "b1", sourceId: "s1", originalPath: "inbox.zip", archiveLineage: [], filename: "inbox.zip", extension: ".zip", declaredMimeType: "application/zip" };

async function zip(entries: Record<string, string>) {
  const archive = new JSZip(); Object.entries(entries).forEach(([path, value]) => archive.file(path, value));
  return Buffer.from(await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

describe("nested archive review invariants", () => {
  it("builds children from clean input without parent lifecycle leaks", async () => {
    const result = await discoverZip({ ...base, archiveItemId: "parent", bytes: await zip({ "font.ttf": "font" }), limits,
      state: "expanding", attempts: 7, stagingPath: "parent-stage", archive: { state: "expanding", terminalChildren: 4 } } as any);
    expect(result.children[0].inventory).not.toHaveProperty("state");
    expect(result.children[0].inventory).not.toHaveProperty("attempts");
    expect(result.children[0].inventory).not.toHaveProperty("archive");
    expect(result.children[0].inventory).not.toHaveProperty("stagingPath", "parent-stage");
  });

  it("reports a real corrupt deflate through unzipper", async () => {
    const bytes = await zip({ "bad.ttf": "The quick brown fox jumps over the lazy dog. ".repeat(20) });
    const local = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const data = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    for (let index = 0; index < 8; index += 1) bytes[data + index] ^= 0xff;
    const result = await discoverZip({ ...base, archiveItemId: "parent", bytes, limits: { ...limits, maxEntryBytes: 2000, maxExpandedBatchBytes: 5000, maxCompressionRatio: 1000 } });
    expect(result.reviews).toContainEqual(expect.objectContaining({ reasonCode: "decompression_failure", entryPath: "bad.ttf" }));
  });

  it("uses the carried shared budget reservation before extracting children", async () => {
    const reservations: string[] = [];
    const result = await discoverZip({ ...base, archiveItemId: "parent", bytes: await zip({ "font.ttf": "font" }), limits,
      reserve: async (reservationId: string) => { reservations.push(reservationId); return { kind: "exceeded", remainingBytes: 0 }; } } as any);
    expect(reservations).toEqual(["parent:font.ttf"]);
    expect(result.reviews).toContainEqual(expect.objectContaining({ reasonCode: "expanded_size" }));
  });

  it("allows an entry up to its reserved allowance, not the post-reservation remainder", async () => {
    const bytes = await zip({ "font.ttf": "0123456789abcdef".repeat(5) });
    const result = await discoverZip({ ...base, archiveItemId: "parent", bytes, limits: { ...limits, maxEntryBytes: 100 },
      reserve: async () => ({ kind: "reserved", remainingBytes: 20, reservationBytes: 80 }) } as any);
    expect(result.children).toHaveLength(1);
    expect(result.reviews).toEqual([]);
  });
});
