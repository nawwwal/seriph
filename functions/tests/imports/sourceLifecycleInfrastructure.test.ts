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
