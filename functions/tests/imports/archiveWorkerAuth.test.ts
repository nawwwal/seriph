import { describe, expect, it, vi } from "vitest";
import { handleArchive, OVERSIZED_ARCHIVE_MAX_BYTES, OVERSIZED_ARCHIVE_MIN_BYTES } from "../../src/imports/archiveWorker/handleArchive";
import { archiveHeaders, archivePayload, testDependencies, testSource } from "./archiveWorkerSupport";

describe("archive worker request validation", () => {
  it("rejects missing task metadata before claiming", async () => {
    const deps = testDependencies();
    await expect(handleArchive({ body: archivePayload, headers: {} }, deps)).resolves.toMatchObject({ status: 400 });
    expect(deps.lease.claim).not.toHaveBeenCalled();
  });
  it("rejects malformed and non-source payloads before storage", async () => {
    const deps = testDependencies();
    await expect(handleArchive({ body: "not-json", headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 400 });
    await expect(handleArchive({ body: { ...archivePayload, kind: "discover_item" }, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 400 });
    expect(deps.source.get).not.toHaveBeenCalled();
  });
  it.each([OVERSIZED_ARCHIVE_MIN_BYTES, OVERSIZED_ARCHIVE_MAX_BYTES + 1])("rejects declared size %s outside the archive lane", async (declaredSize) => {
    const deps = testDependencies(testSource({ declaredSize }), { oversizedMinBytes: OVERSIZED_ARCHIVE_MIN_BYTES, oversizedMaxBytes: OVERSIZED_ARCHIVE_MAX_BYTES });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 400 });
    expect(deps.lease.claim).not.toHaveBeenCalled();
  });
  it("reads an eligible source through createReadStream only", async () => {
    const deps = testDependencies(); const source = await deps.source.get("owner-1", "batch-1", "source-1");
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 204 });
    expect(source?.createReadStream).toHaveBeenCalledTimes(2); expect(deps.persistence.persistChild).toHaveBeenCalledOnce();
  });
});
