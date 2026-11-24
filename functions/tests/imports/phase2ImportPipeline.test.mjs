import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { detectContentSignature } = require("../../lib/imports/discovery/contentSignature.js");
const { classifyRole } = require("../../lib/imports/discovery/classifyRole.js");
const { buildImportPlan } = require("../../lib/imports/planning/buildPlan.js");
const { canonicalizeImportTaskPayload } = require("../../lib/imports/tasks/enqueue.js");
const { faceFieldsFromAssets, familyFieldsFromClaims, assetSizeBytes } = require("../../lib/imports/store/mutationMetadata.js");
const { summarizeCatalogFamilyRecords } = require("../../lib/storage/catalogSummary.js");

test("detectContentSignature recognizes Apple TrueType 'true' magic as TTF", () => {
  const bytes = Buffer.from([0x74, 0x72, 0x75, 0x65, 0x00, 0x0c, 0x00, 0x80]);
  assert.equal(detectContentSignature(bytes), "TTF");
});

test("classifyRole discards macOS resource forks and AppleDouble files", () => {
  const sfnt = Buffer.from([0x4f, 0x54, 0x54, 0x4f, 0x00, 0x08]);
  assert.equal(classifyRole({ bytes: sfnt, name: "__MACOSX/Garet/._Garet-Regular.otf" }).role, "junk");
  assert.equal(classifyRole({ bytes: Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00]), name: "font.otf" }).role, "junk");
});

test("buildImportPlan handles empty 0-font inputs cleanly", () => {
  const plan = buildImportPlan([], 1, { ownerId: "user-1", batchId: "batch-1" });
  assert.equal(plan.families.length, 0);
  assert.equal(plan.reviewItems.length, 0);
});

test("canonicalizeImportTaskPayload preserves retryAttempt", () => {
  const payload = canonicalizeImportTaskPayload({
    kind: "apply_family",
    ownerId: "user-1",
    batchId: "batch-1",
    resourceId: "fam-1",
    planVersion: 1,
    retryAttempt: 2,
  });
  assert.equal(payload.retryAttempt, 2);

  const reconcilePayload = canonicalizeImportTaskPayload({
    kind: "reconcile_batch",
    ownerId: "user-1",
    batchId: "batch-1",
    resourceId: "batch-1",
    observedAtMs: 12345,
  });
  assert.equal(reconcilePayload.observedAtMs, 12345);
});

test("mutationMetadata preserves variable axes, metadata, and fileSize", () => {
  const asset = {
    assetId: "a1",
    itemId: "i1",
    sha256: "deadbeef",
    format: "woff2",
    bytes: Buffer.alloc(4321),
    source: {
      fontMetadata: {
        isVariable: true,
        variableAxes: [{ tag: "wght", name: "Weight", min: 100, max: 900, default: 400 }],
        classification: "Serif",
        foundry: "Foundry X",
        designer: "Designer Y",
        licenseUrl: "OFL-1.1",
        glyphCount: 412,
        openTypeFeatures: ["liga", "kern"],
        isFixedPitch: false,
      },
    },
  };
  const faceFields = faceFieldsFromAssets([asset]);
  assert.equal(faceFields.isVariable, true);
  assert.equal(faceFields.axes?.length, 1);
  assert.equal(faceFields.meta?.glyphCount, 412);
  assert.equal(assetSizeBytes([asset], { format: "woff2", url: "https://x", contentHash: "deadbeef" }), 4321);

  const familyFields = familyFieldsFromClaims(undefined, [asset], [{ ...faceFields, id: "f1" }], new Date("2026-01-01T00:00:00Z"));
  assert.equal(familyFields.isVariable, true);
  assert.equal(familyFields.category, "SERIF");
  assert.equal(familyFields.foundry, "Foundry X");
  assert.equal(familyFields.designer, "Designer Y");
  assert.equal(familyFields.axes?.length, 1);
});

test("summarizeCatalogFamilyRecords aggregates non-hidden families and revisions", () => {
  const summary = summarizeCatalogFamilyRecords([
    { name: "Alpha", styleCount: 4, createdAt: "2026-01-01T00:00:00Z", hidden: false },
    { name: "Beta", styleCount: 2, createdAt: "2026-01-02T00:00:00Z", hidden: false },
    { name: "Alias", styleCount: 1, createdAt: "2026-01-03T00:00:00Z", hidden: true },
  ], "2026-01-04T00:00:00Z", 9);
  assert.equal(summary.familyCount, 2);
  assert.equal(summary.styleCount, 6);
  assert.equal(summary.recentFamilyName, "Beta");
  assert.equal(summary.libraryRevision, 9);
});
