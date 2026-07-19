import { describe, expect, it } from "vitest";
import { finalizeProviderFailure, finalizeProviderSubmission, recordProviderSubmission } from "../../src/ingest/batch/submissionStore";
import { persistSubmissionIntent } from "../../src/ingest/batch/submissionIntent";
import type { EnrichmentJob } from "../../src/enrichment/jobs/jobTypes";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

class FakeDb {
  readonly docs = new Map<string, Record<string, unknown>>();
  collection = (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, id }) });
  private write = (ref: { path: string }, data: Record<string, unknown>, merge?: boolean) => {
    this.docs.set(ref.path, merge ? { ...this.docs.get(ref.path), ...data } : data);
  };
  batch = () => ({
    set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => this.write(ref, data, options?.merge),
    commit: async () => undefined,
  });
  runTransaction = async (work: (tx: { get: typeof this.get; set: typeof this.write }) => Promise<void>) => {
    await work({ get: this.get, set: this.write });
  };
  get = async (ref: { path: string }) => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path) });
}

const job = { jobId: "job-a", familyId: "family-a", familyVersion: 3 } as EnrichmentJob;
const family = { id: "family-a", version: 3, slug: "family-a" } as FontFamilyDoc;
const record = {
  id: "run-a", providerJobName: "", expectedJobIds: [job.jobId], inputUri: "gs://bucket/in",
  outputPrefix: "run-a/out", state: "SUBMISSION_SUBMITTING", submissionState: "submitting" as const,
};

describe("provider submission durability", () => {
  it("persists intent, render rejection, and idempotent provider finalization", async () => {
    const db = new FakeDb();
    await persistSubmissionIntent(db as never, record, [job], [family], [{ jobId: "bad", code: "render_failed" }], new Date(1));

    expect(db.docs.get("batchJobs/run-a")).toMatchObject({ submissionState: "submitting", expectedJobIds: ["job-a"] });
    expect(db.docs.get("enrichmentJobs/job-a")).toMatchObject({ state: "submitting", leaseExpiresAt: new Date(1) });
    expect(db.docs.get("enrichmentJobs/bad")).toMatchObject({ state: "failed", failureCode: "render_failed" });

    await recordProviderSubmission(db as never, "run-a", { name: "providers/run-a", state: "JOB_STATE_PENDING" });
    await finalizeProviderSubmission(db as never, "run-a");
    await finalizeProviderSubmission(db as never, "run-a");
    expect(db.docs.get("enrichmentJobs/job-a")).toMatchObject({ state: "submitted", providerJobName: "providers/run-a" });
    expect(db.docs.get("batchJobs/run-a")).toMatchObject({ submissionState: "submitted" });

    const failed = new FakeDb();
    await persistSubmissionIntent(failed as never, record, [job], [family], [], new Date(1));
    await finalizeProviderFailure(failed as never, "run-a", new Error("provider down"), "input");
    await finalizeProviderFailure(failed as never, "run-a", new Error("provider down"), "input");
    expect(failed.docs.get("enrichmentJobs/job-a")).toMatchObject({ state: "retrying", failureCode: "provider down" });
  });
});
