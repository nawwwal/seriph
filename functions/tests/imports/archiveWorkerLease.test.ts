import { describe, expect, it, vi } from "vitest";
import { handleArchive } from "../../src/imports/archiveWorker/handleArchive";
import { archiveHeaders, archivePayload, testDependencies, testSource } from "./archiveWorkerSupport";

describe("archive worker lease lifecycle", () => {
  it("marks a failed attempt retryable before returning 503", async () => {
    const base = testDependencies(); const deps = testDependencies(testSource(), { persistence: { ...base.persistence, createArchive: vi.fn().mockRejectedValue(new Error("boom")) } });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 503, body: { retryable: true } });
    expect(deps.lease.fail).toHaveBeenCalledWith(archivePayload, archiveHeaders["x-cloudtasks-taskname"], 1, true);
  });
  it("can reclaim after failure and completes the successful retry", async () => {
    const deps = testDependencies(); const claim = deps.lease.claim as ReturnType<typeof vi.fn>;
    const fail = deps.lease.fail as ReturnType<typeof vi.fn>; const complete = deps.lease.complete as ReturnType<typeof vi.fn>;
    claim.mockResolvedValueOnce({ kind: "claimed", attempt: 1 }).mockResolvedValueOnce({ kind: "claimed", attempt: 2 });
    const first = testDependencies(testSource(), { lease: { ...deps.lease, claim, fail: vi.fn().mockResolvedValue(undefined) } });
    first.persistence.createArchive = vi.fn().mockRejectedValueOnce(new Error("retry me"));
    await handleArchive({ body: archivePayload, headers: archiveHeaders }, first);
    const second = testDependencies(testSource(), { lease: { ...deps.lease, claim, fail, complete } });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, second)).resolves.toMatchObject({ status: 204 });
    expect(claim).toHaveBeenCalledTimes(2); expect(complete).toHaveBeenCalledWith(archivePayload, archiveHeaders["x-cloudtasks-taskname"], 2);
  });
});
