import { describe, expect, it } from "vitest";
import { ensureQueuedEnrichmentJob, claimEnrichmentJob, releaseClaimedEnrichmentJob, jobFromInput } from "../../src/enrichment/jobs/jobStore";
import { enrichmentJobId } from "../../src/enrichment/jobs/jobTypes";
import { retryState } from "../../src/enrichment/jobs/retryPolicy";
import { processRealtimeEnrichmentJob } from "../../src/enrichment/realtime/processJob";

type Data = Record<string, any>;
class Snapshot {
  constructor(public readonly id: string, private readonly value: Data | undefined) {}
  get exists() { return this.value !== undefined; }
  data() { return this.value; }
}
class Ref {
  readonly id: string;
  constructor(public readonly path: string, private readonly db: Db) { this.id = path.split("/").pop()!; }
  async get() {
    if (this.path.startsWith("fontfamilies/") && this.db.nextFamilyRead !== undefined && this.db.familyReads > 0) {
      const next = this.db.nextFamilyRead;
      this.db.nextFamilyRead = undefined;
      return new Snapshot(this.id, next ?? undefined);
    }
    if (this.path.startsWith("fontfamilies/")) this.db.familyReads += 1;
    return new Snapshot(this.id, this.db.docs.get(this.path));
  }
  async set(value: Data, options?: { merge?: boolean }) { this.db.write(this.path, value, options?.merge === true); }
}
class Tx {
  constructor(private readonly db: Db) {}
  get(ref: Ref) { return ref.get(); }
  set(ref: Ref, value: Data, options?: { merge?: boolean }) { this.db.write(ref.path, value, options?.merge === true); }
}
class Db {
  docs = new Map<string, Data>();
  nextFamilyRead: Data | null | undefined = undefined;
  familyReads = 0;
  collection(name: string) { return { doc: (id: string) => new Ref(`${name}/${id}`, this) }; }
  runTransaction<T>(work: (tx: Tx) => Promise<T>) { return work(new Tx(this)); }
  write(path: string, value: Data, merge: boolean) {
    const next = merge ? { ...(this.docs.get(path) ?? {}) } : {};
    for (const [key, item] of Object.entries(value)) {
      if (item?.constructor?.name === "DeleteTransform") delete next[key];
      else next[key] = item;
    }
    this.docs.set(path, next);
  }
}

const input = (ownerId: string) => ({
  ownerId, batchId: "batch-1", familyId: "atlas", familyVersion: 3, planVersion: 1,
  promptVersion: "enrich-v1", analysisModel: "gemini-3.5-flash-lite", embeddingVersion: "embed:2048",
});
const provenance = { kind: "backfill" as const, source: "test", reason: "missing", familyVersion: 3, requestedAt: new Date(1).toISOString() };

describe("Firestore enrichment job lease integration", () => {
  it("keeps owner-scoped job identities distinct", () => {
    expect(enrichmentJobId(input("owner-a"))).not.toBe(enrichmentJobId(input("owner-b")));
  });

  it("allows one claimant, respects retryAt, and takes over an expired lease", async () => {
    const db = new Db();
    db.docs.set("fontfamilies/owner-a__atlas", { ownerId: "owner-a", slug: "atlas", version: 3, status: "ready", faces: [{}] });
    const job = await ensureQueuedEnrichmentJob(db as never, { ...input("owner-a"), now: new Date(100) }, provenance);
    const first = await claimEnrichmentJob(db as never, job.job.jobId, { now: new Date(200), leaseMs: 1000 });
    expect(first).toMatchObject({ state: "rendering", ownerId: "owner-a" });
    expect(await claimEnrichmentJob(db as never, job.job.jobId, { now: new Date(300) })).toBeNull();

    const retryJob = jobFromInput({ ...input("owner-a"), familyId: "retry", now: new Date(100) });
    db.docs.set("fontfamilies/owner-a__retry", { ownerId: "owner-a", slug: "retry", version: 3, status: "ready", faces: [{}] });
    db.docs.set(`enrichmentJobs/${retryJob.jobId}`, { ...retryJob, state: "retrying", retryAt: new Date(10_000) });
    expect(await claimEnrichmentJob(db as never, retryJob.jobId, { now: new Date(9_999) })).toBeNull();
    const retryClaim = await claimEnrichmentJob(db as never, retryJob.jobId, { now: new Date(10_001), leaseMs: 100 });
    expect(retryClaim?.state).toBe("rendering");

    const expired = await releaseClaimedEnrichmentJob(db as never, retryClaim!, "temporary", retryState(0), new Date(10_002));
    expect(expired).toBe(true);
    const queued = db.docs.get(`enrichmentJobs/${retryJob.jobId}`);
    expect(queued).toMatchObject({ state: "retrying", attempt: 1 });

    const reclaimed = await claimEnrichmentJob(db as never, retryJob.jobId, { now: new Date(10_003), leaseMs: 100 });
    expect(reclaimed).toBeNull();
    const expiredLeaseJob = await claimEnrichmentJob(db as never, job.job.jobId, { now: new Date(1_301), leaseMs: 100 });
    expect(expiredLeaseJob?.leaseId).not.toBe(first?.leaseId);
  });

  it("terminally releases jobs when the family disappears or drifts after claim", async () => {
    const missingDb = new Db();
    missingDb.docs.set("fontfamilies/owner-a__missing", { ownerId: "owner-a", slug: "missing", version: 1, status: "ready", faces: [{}] });
    const missing = await ensureQueuedEnrichmentJob(missingDb as never, { ...input("owner-a"), familyId: "missing", familyVersion: 1 }, provenance);
    missingDb.nextFamilyRead = null;
    expect(await processRealtimeEnrichmentJob(missingDb as never, missing.job)).toBe(false);
    expect(missingDb.docs.get(`enrichmentJobs/${missing.job.jobId}`)).toMatchObject({ state: "failed", failureCode: "family_missing" });

    const staleDb = new Db();
    staleDb.docs.set("fontfamilies/owner-a__stale", { ownerId: "owner-a", slug: "stale", version: 1, status: "ready", faces: [{}] });
    const stale = await ensureQueuedEnrichmentJob(staleDb as never, { ...input("owner-a"), familyId: "stale", familyVersion: 1 }, provenance);
    staleDb.nextFamilyRead = { ownerId: "owner-a", slug: "stale", version: 2, status: "ready", faces: [{}] };
    expect(await processRealtimeEnrichmentJob(staleDb as never, stale.job)).toBe(false);
    expect(staleDb.docs.get(`enrichmentJobs/${stale.job.jobId}`)).toMatchObject({ state: "failed", failureCode: "family_stale" });
  });
});
