import { describe, expect, it } from "vitest";
import { buildSubmissionCandidates } from "../../src/ingest/batch/submit";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

const malformedFamily = { id: "bad", slug: "bad", status: "ready", faces: [], version: 1 } as FontFamilyDoc;
const validFamily = {
  id: "good", slug: "good", status: "ready", ownerId: "user-1", faces: [{}], version: 1,
} as FontFamilyDoc;

describe("buildSubmissionCandidates", () => {
  it("submits valid families when one selected family is malformed", async () => {
    const renderFixture = async (family: FontFamilyDoc) => {
      if (family.id === malformedFamily.id) throw new Error("missing specimen asset");
      return null;
    };

    const result = await buildSubmissionCandidates([malformedFamily, validFamily], renderFixture);

    expect(result.accepted.map((entry) => entry.family.id)).toEqual([validFamily.id]);
    expect(result.rejected).toHaveLength(1);
  });
});
