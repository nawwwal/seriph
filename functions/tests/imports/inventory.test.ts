import { describe, expect, it } from "vitest";
import { buildInventoryItem } from "../../src/imports/discovery/inventory";
import { classifyInventoryItem } from "../../src/imports/discovery/classifyRole";
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

});
