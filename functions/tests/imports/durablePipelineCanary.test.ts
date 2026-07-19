import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { discoverZip } from "../../src/imports/discovery/discoverZip";
import { buildImportPlan, type PlanInventoryItem } from "../../src/imports/planning/buildPlan";
import type { FontFormat } from "../../src/storage/transcode";
import { DurableCanaryStore } from "./durableCanaryStore";

const limits = { maxDepth: 4, maxEntries: 100, maxExpandedBatchBytes: 1_000_000, maxEntryBytes: 100_000, maxCompressionRatio: 100, maxPathBytes: 1024 };
const base = { ownerId: "owner-1", batchId: "canary-1", sourceId: "source-1", originalPath: "mixed.zip", archiveLineage: [], filename: "mixed.zip", extension: ".zip", declaredMimeType: "application/zip" };
const tempDirs: string[] = [];
const identity = (familyName: string, styleName: string, format: FontFormat) => ({ familyName, familyKey: familyName.toLowerCase(), familySlug: familyName.toLowerCase(), styleName, weight: styleName === "Bold" ? 700 : 400, width: 100, italic: false, logicalFaceKey: `${styleName.toLowerCase()}|w-${styleName === "Bold" ? 700 : 400}|wdth-100|italic-no`, containerFormat: format, technology: format, reasons: [] });

async function fixture() {
  const zip = new JSZip();
  zip.file("fonts/Atlas-Regular.otf", Buffer.from([0, 1, 0, 0])); zip.file("fonts/Atlas-Regular-copy.otf", Buffer.from([0, 1, 0, 0]));
  zip.file("fonts/Atlas-Regular.woff2", Buffer.from("wOF2atlas")); zip.file("fonts/Nova-Bold.woff2", Buffer.from("wOF2nova"));
  zip.file("README.md", "# mixed archive\n"); zip.file(".DS_Store", "junk"); zip.file("../escape.ttf", "unsafe");
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function runDurablePipeline(bytes: Buffer, store: DurableCanaryStore) {
  const discovery = await discoverZip({ ...base, archiveItemId: "archive-1", bytes, limits });
  const receiptIds = [
    ...discovery.children.map(({ inventory }) => `item:${inventory.itemId}`),
    ...discovery.reviews.map((review) => `review:${review.reasonCode}:${review.entryPath}`),
  ];
  let newReceipts = 0;
  for (const child of discovery.children) newReceipts += Number(store.put("receipts", `item:${child.inventory.itemId}`, { action: child.inventory.action }));
  for (const review of discovery.reviews) newReceipts += Number(store.put("receipts", `review:${review.reasonCode}:${review.entryPath}`, { reasonCode: review.reasonCode }));
  const fonts = discovery.children.filter(({ inventory }) => inventory.role === "font").map(({ inventory }) => ({ ...inventory, id: inventory.itemId, identity: identity(inventory.filename.startsWith("Nova") ? "Nova" : "Atlas", inventory.filename.includes("Bold") ? "Bold" : "Regular", inventory.detectedFormat as FontFormat) } as PlanInventoryItem));
  const plan = buildImportPlan(fonts); const mutations = plan.families.flatMap((family) => family.faces.flatMap((face) => face.assets.map((asset) => ({ familyId: family.familyId, assetId: asset.assetId }))));
  const mutationIds = mutations.map(({ familyId, assetId }) => `${familyId}:${assetId}`);
  const publicObjectIds = mutationIds.map((mutationId) => `d/${mutationId}`);
  let newMutations = 0; let newPublicObjects = 0;
  for (const mutation of mutations) {
    const mutationId = `${mutation.familyId}:${mutation.assetId}`;
    newMutations += Number(store.put("mutations", mutationId, { familyId: mutation.familyId, assetId: mutation.assetId, status: "applied" }));
    newPublicObjects += Number(store.put("publicObjects", `d/${mutationId}`, { mutationId, status: "published" }));
  }
  return { catalogFamilies: plan.families.map((family) => family.familyName), receiptIds, mutationIds, publicObjectIds, newReceipts, newMutations, newPublicObjects, review: discovery.reviews.map((item) => item.reasonCode), privateRoles: discovery.children.map(({ inventory }) => inventory.action) };
}

afterEach(() => tempDirs.splice(0).forEach((directory) => fs.rmSync(directory, { force: true, recursive: true })));

describe("durable import replay canary", () => {
  it("replays persisted receipts, mutations, and public objects through a fresh store handle", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "seriph-canary-")); tempDirs.push(directory);
    const filename = path.join(directory, "records.json"); const bytes = await fixture();
    const first = await runDurablePipeline(bytes, new DurableCanaryStore(filename));
    const second = await runDurablePipeline(bytes, new DurableCanaryStore(filename));
    const persisted = new DurableCanaryStore(filename).snapshot();
    expect(first.catalogFamilies).toEqual(["Atlas", "Nova"]); expect(first.mutationIds).toHaveLength(3); expect(first.newReceipts).toBeGreaterThan(0); expect(first.newMutations).toBe(3); expect(first.newPublicObjects).toBe(3);
    expect(first.privateRoles).toEqual(expect.arrayContaining(["retain_private", "discard"])); expect(first.review).toContain("path_traversal");
    expect(second.receiptIds).toEqual(first.receiptIds); expect(second.mutationIds).toEqual(first.mutationIds); expect(second.publicObjectIds).toEqual(first.publicObjectIds);
    expect(second.newReceipts).toBe(0); expect(second.newMutations).toBe(0); expect(second.newPublicObjects).toBe(0);
    expect(Object.keys(persisted.receipts).sort()).toEqual(first.receiptIds.sort()); expect(Object.keys(persisted.mutations).sort()).toEqual(first.mutationIds.sort()); expect(Object.keys(persisted.publicObjects).sort()).toEqual(first.publicObjectIds.sort());
  });
});
