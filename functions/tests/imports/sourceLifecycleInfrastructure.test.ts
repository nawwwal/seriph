import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { resolveStorageBucket } from "../../src/bootstrap/storageBucket";

it("resolves the finalized-source bucket from the same Admin configuration sources", () => {
  expect(resolveStorageBucket({ GOOGLE_CLOUD_STORAGE_BUCKET: "google-bucket" })).toBe("google-bucket");
  expect(resolveStorageBucket({ FIREBASE_CONFIG: JSON.stringify({ storageBucket: "config-bucket" }) })).toBe("config-bucket");
  expect(resolveStorageBucket({ FIREBASE_CONFIG: "not-json" })).toBeUndefined();
});

it("declares the sources state and updated-at collection-group index", () => {
  const indexes = JSON.parse(readFileSync(resolve(process.cwd(), "../firestore.indexes.json"), "utf8"));
  expect(indexes.indexes).toContainEqual({
    collectionGroup: "sources",
    queryScope: "COLLECTION_GROUP",
    fields: [{ fieldPath: "state", order: "ASCENDING" }, { fieldPath: "updatedAt", order: "ASCENDING" }],
  });
});

it("declares the collection-group contracts used by stale batch recovery", () => {
  const indexes = JSON.parse(readFileSync(resolve(process.cwd(), "../firestore.indexes.json"), "utf8"));
  expect(indexes.indexes).toContainEqual({ collectionGroup: "importBatches", queryScope: "COLLECTION_GROUP", fields: [
    { fieldPath: "outcome", order: "ASCENDING" }, { fieldPath: "updatedAt", order: "ASCENDING" },
  ] });
  expect(indexes.fieldOverrides).toContainEqual(expect.objectContaining({
    collectionGroup: "importBatches", fieldPath: "pendingDispatch.task.kind",
    indexes: expect.arrayContaining([expect.objectContaining({ order: "ASCENDING", queryScope: "COLLECTION_GROUP" })]),
  }));
});
