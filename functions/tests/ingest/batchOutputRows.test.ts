import { describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  file: { name: "run/output.jsonl", download: async () => [Buffer.from('{"key":null}\nnot-json\n')] },
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ getFiles: async () => [[storage.file]] }) }),
}));
vi.mock("../../src/ai/enrichFont", () => ({ CATALOG_KEY_PREFIX: "Catalog-Key:" }));

describe("batch JSONL output rows", () => {
  it("preserves malformed rows for reconciliation", async () => {
    const { readOutputLines } = await import("../../src/ingest/batch/outputRows");

    await expect(readOutputLines("bucket", "run/")).resolves.toEqual([
      { key: null }, { __malformedJsonl: true },
    ]);
  });
});
