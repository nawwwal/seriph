import { describe, expect, it } from "vitest";
import { buildProviderRun } from "../../src/enrichment/provider/buildInput";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import type { EnrichmentJob } from "../../src/enrichment/jobs/jobTypes";

const family = (id: string): FontFamilyDoc => ({
  id,
  slug: id,
  name: id,
  fileBase: id,
  category: "SANS_SERIF",
  ownerId: "owner-1",
  status: "ready",
  version: 3,
  faces: [{
    id: "regular", styleName: "Regular", weight: 400, weightName: "Regular", width: 100,
    italic: false, isVariable: false, format: "WOFF2", fileSize: 1, filename: "regular.woff2",
  }],
});

const job = (id: string) => ({
  id,
  familyId: `${id}-family`,
  familyVersion: 3,
  promptVersion: "prompt-v3",
  analysisModel: "gemini-test",
  embeddingVersion: "embed-v2:768",
} as EnrichmentJob & { id: string });

const deps = (badId?: string) => ({
  loadFamily: async (entry: EnrichmentJob & { id: string }) => family(`${entry.id}-family`),
  render: async (entry: EnrichmentJob & { id: string }) => entry.id === badId ? null : Buffer.from("png"),
  providerRunId: "run-1",
});

describe("provider submission input", () => {
  it("records every accepted job before provider submission", async () => {
    const jobA = job("job-a");
    const jobB = job("job-b");

    const run = await buildProviderRun([jobA, jobB], deps());

    expect(run.expectedJobIds).toEqual([jobA.id, jobB.id]);
    expect(run.rows).toHaveLength(2);
  });

  it("rejects one render failure without omitting it silently", async () => {
    const badRender = job("bad-render");
    const jobB = job("job-b");

    const run = await buildProviderRun([badRender, jobB], deps(badRender.id));

    expect(run.rejected).toEqual([{ jobId: badRender.id, code: "render_failed" }]);
  });
});
