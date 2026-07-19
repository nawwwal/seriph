import { describe, expect, it } from "vitest";
import { collectPendingEnrichmentJobs } from "../../src/enrichment/jobs/production";
import { enrichmentJobId, type EnrichmentJob } from "../../src/enrichment/jobs/jobTypes";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import { ENRICHMENT_COLLECTOR_OPTIONS } from "../../src/options";

const job: EnrichmentJob = {
  familyId: "owner__atlas",
  familyVersion: 4,
  promptVersion: "enrich-v1",
  analysisModel: "gemini-test",
  embeddingVersion: "embed-v2:768",
  jobId: enrichmentJobId({ familyId: "owner__atlas", familyVersion: 4, promptVersion: "enrich-v1", analysisModel: "gemini-test", embeddingVersion: "embed-v2:768" }),
  ownerId: "owner",
  batchId: "batch",
  planVersion: 2,
  state: "queued",
};

const family = { ownerId: "owner", faces: [{ id: "regular", preferredAssetId: "asset", assets: [{ id: "asset" }] }] } as FontFamilyDoc;

describe("production enrichment collection", () => {
  it("runs on the five-minute production collector cadence", () => {
    expect(ENRICHMENT_COLLECTOR_OPTIONS.schedule).toBe("every 5 minutes");
  });

  it("dispatches the queued jobs selected by the collector", async () => {
    const states: string[] = [];
    const dispatched: EnrichmentJob[][] = [];

    await expect(collectPendingEnrichmentJobs({
      enabled: true,
      maxBatchSize: 1,
      listJobs: async () => [job],
      loadFamily: async () => family,
      render: async () => Buffer.from("specimen"),
      markState: async (_, state) => { states.push(state); },
      dispatch: async (jobs) => { dispatched.push([...jobs]); },
    })).resolves.toMatchObject({ selected: 1, rejected: 0, submitted: 1 });

    expect(dispatched).toEqual([[job]]);
    expect(states).toEqual(["submitted"]);
  });
});
