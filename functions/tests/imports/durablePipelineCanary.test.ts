import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { discoverZip } from "../../src/imports/discovery/discoverZip";
import { buildImportPlan, type PlanInventoryItem } from "../../src/imports/planning/buildPlan";
import type { FontFormat } from "../../src/storage/transcode";

const limits = { maxDepth: 4, maxEntries: 100, maxExpandedBatchBytes: 1_000_000, maxEntryBytes: 100_000, maxCompressionRatio: 100, maxPathBytes: 1024 };
const base = { ownerId: "owner-1", batchId: "canary-1", sourceId: "source-1", originalPath: "mixed.zip", archiveLineage: [], filename: "mixed.zip", extension: ".zip", declaredMimeType: "application/zip" };
const identity = (familyName: string, styleName: string, format: FontFormat) => ({ familyName, familyKey: familyName.toLowerCase(), familySlug: familyName.toLowerCase(), styleName, weight: styleName === "Bold" ? 700 : 400, width: 100, italic: false, logicalFaceKey: `${styleName.toLowerCase()}|w-${styleName === "Bold" ? 700 : 400}|wdth-100|italic-no`, containerFormat: format, technology: format, reasons: [] });

async function fixture() {
  const zip = new JSZip();
  zip.file("fonts/Atlas-Regular.otf", Buffer.from([0, 1, 0, 0])); zip.file("fonts/Atlas-Regular-copy.otf", Buffer.from([0, 1, 0, 0]));
  zip.file("fonts/Atlas-Regular.woff2", Buffer.from("wOF2atlas")); zip.file("fonts/Nova-Bold.woff2", Buffer.from("wOF2nova"));
  zip.file("README.md", "# mixed archive\\n"); zip.file(".DS_Store", "junk"); zip.file("../escape.ttf", "unsafe");
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function runDurablePipeline(bytes: Buffer, seen = new Set<string>()) {
  const discovery = await discoverZip({ ...base, archiveItemId: "archive-1", bytes, limits });
  const fonts = discovery.children.filter(({ inventory }) => inventory.role === "font").map(({ inventory }) => ({ ...inventory, id: inventory.itemId, identity: identity(inventory.filename.startsWith("Nova") ? "Nova" : "Atlas", inventory.filename.includes("Bold") ? "Bold" : "Regular", inventory.detectedFormat as FontFormat) } as PlanInventoryItem));
  const plan = buildImportPlan(fonts); const mutationIds = plan.families.flatMap((family) => family.faces.flatMap((face) => face.assets.map((asset) => `${family.familyId}:${asset.assetId}`)));
  const newPublicObjects = mutationIds.filter((id) => !seen.has(id)); mutationIds.forEach((id) => seen.add(id));
  return { catalogFamilies: plan.families.map((family) => family.familyName), mutationIds, newPublicObjects: newPublicObjects.length, review: discovery.reviews.map((item) => item.reasonCode), privateRoles: discovery.children.map(({ inventory }) => inventory.action) };
}

describe("durable import replay canary", () => {
  it("keeps mixed-archive outcomes and replay mutations stable", async () => {
    const seen = new Set<string>(); const bytes = await fixture(); const first = await runDurablePipeline(bytes, seen); const second = await runDurablePipeline(bytes, seen);
    expect(first.catalogFamilies).toEqual(["Atlas", "Nova"]); expect(first.mutationIds).toHaveLength(3); expect(first.newPublicObjects).toBe(3);
    expect(first.privateRoles).toEqual(expect.arrayContaining(["retain_private", "discard"])); expect(first.review).toContain("path_traversal");
    expect(second.mutationIds).toEqual(first.mutationIds); expect(second.newPublicObjects).toBe(0);
  });
});
