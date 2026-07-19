import { describe, expect, it } from "vitest";
import { resolveImportTriggerBucket } from "../../src/imports/config/sourceTriggerConfig";

describe("import source trigger bucket", () => {
  it("prefers the Cloud Storage bucket environment variable", () => {
    expect(resolveImportTriggerBucket({
      GOOGLE_CLOUD_STORAGE_BUCKET: "runtime-bucket",
      FIREBASE_CONFIG: JSON.stringify({ storageBucket: "firebase-bucket" }),
    })).toBe("runtime-bucket");
  });

  it("uses the Firebase config storage bucket when the runtime variable is absent", () => {
    expect(resolveImportTriggerBucket({
      FIREBASE_CONFIG: JSON.stringify({ storageBucket: "firebase-bucket" }),
    })).toBe("firebase-bucket");
  });

  it("uses the test fallback when no bucket is configured", () => {
    expect(resolveImportTriggerBucket({ FIREBASE_CONFIG: "not-json" })).toBe("unit-test-bucket");
  });
});
