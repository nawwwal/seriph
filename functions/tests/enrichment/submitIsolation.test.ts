import { beforeEach, describe, expect, it, vi } from "vitest";
const { batchEnabled, loggerInfo, readyGet } = vi.hoisted(() => ({
  batchEnabled: vi.fn(), loggerInfo: vi.fn(), readyGet: vi.fn(),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn() },
  getFirestore: () => ({ collection: () => ({ where: () => ({ limit: () => ({ get: readyGet }) }) }) }),
}));
vi.mock("firebase-functions", () => ({ logger: { info: loggerInfo, warn: vi.fn() } }));
vi.mock("../../src/ai/vertex/vertexClient", () => ({ isVertexEnabled: () => true }));
vi.mock("../../src/ingest/batch/client", () => ({ batchEnrichEnabled: batchEnabled }));

import { buildSubmissionCandidates, submitPendingEnrichmentBatch } from "../../src/ingest/batch/submit";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

const malformedFamily = { id: "bad", slug: "bad", status: "ready", faces: [], version: 1 } as FontFamilyDoc;
const validFamily = {
  id: "good", slug: "good", status: "ready", ownerId: "user-1", faces: [{}], version: 1,
} as FontFamilyDoc;

describe("buildSubmissionCandidates", () => {
  beforeEach(() => {
    batchEnabled.mockReset();
    loggerInfo.mockReset();
    readyGet.mockReset();
  });

  it("submits valid families when one selected family is malformed", async () => {
    const renderFixture = async (family: FontFamilyDoc) => {
      if (family.id === malformedFamily.id) throw new Error("missing specimen asset");
      return null;
    };

    const result = await buildSubmissionCandidates([malformedFamily, validFamily], renderFixture);

    expect(result.accepted.map((entry) => entry.family.id)).toEqual([validFamily.id]);
    expect(result.rejected).toHaveLength(1);
  });

  it.each([
    ["is disabled", false, undefined, "[batch] enrichment disabled (kill-switch); skipping submit. selected 0, submitted 0, rejected 0."],
    ["has no ready families", true, { docs: [] }, "[batch] no pending families to enrich. selected 0, submitted 0, rejected 0."],
  ])("logs zero submission counts when enrichment %s", async (_, enabled, snapshot, message) => {
    batchEnabled.mockReturnValue(enabled);
    if (snapshot) readyGet.mockResolvedValue(snapshot);

    await expect(submitPendingEnrichmentBatch()).resolves.toEqual({ selected: 0, submitted: 0, rejected: 0 });

    expect(loggerInfo).toHaveBeenCalledWith(message);
  });
});
