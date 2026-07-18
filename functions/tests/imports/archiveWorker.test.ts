import { execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleArchive, OVERSIZED_ARCHIVE_MAX_BYTES, OVERSIZED_ARCHIVE_MIN_BYTES, type ArchiveWorkerDependencies } from "../../src/imports/archiveWorker/handleArchive";

const payload = {
  kind: "discover_source" as const,
  ownerId: "owner-1",
  batchId: "batch-1",
  resourceId: "source-1",
  planVersion: 1,
};

const limits = {
  maxDepth: 4,
  maxEntries: 100,
  maxExpandedBatchBytes: 100,
  maxEntryBytes: 50,
  maxCompressionRatio: 100,
  maxPathBytes: 1024,
};

function request(body: unknown = payload, headers: Record<string, string> = {
  "x-cloudtasks-taskname": "projects/seriph/locations/asia-southeast1/queues/seriph-import/tasks/task-1",
  "x-cloudtasks-queuename": "seriph-import",
}) {
  return { body, headers };
}

function dependencies(overrides: Partial<ArchiveWorkerDependencies> = {}): ArchiveWorkerDependencies {
  return {
    limits,
    source: {
      get: vi.fn().mockResolvedValue({
        ...payload,
        sourceId: payload.resourceId,
        originalPath: "inbox.zip",
        filename: "inbox.zip",
        declaredSize: OVERSIZED_ARCHIVE_MIN_BYTES + 1,
        declaredMimeType: "application/zip",
        storagePath: "intake/owner-1/batch-1/source-1.zip",
        state: "uploaded",
        createReadStream: vi.fn(() => Readable.from([Buffer.from("archive")])) ,
      }),
    },
    parser: vi.fn(async function* () {
      yield {
        path: "font.ttf",
        type: "File",
        flags: 0,
        compressionMethod: 0,
        compressedSize: 4,
        uncompressedSize: 4,
        stream: () => Readable.from([Buffer.from([0, 1, 0, 0])]),
      };
    }),
    lease: {
      claim: vi.fn().mockResolvedValue({ kind: "claimed", attempt: 1 }),
      renew: vi.fn().mockResolvedValue(undefined),
    },
    persistence: {
      createArchive: vi.fn().mockResolvedValue(undefined),
      reserve: vi.fn().mockResolvedValue({ kind: "reserved", remainingBytes: 96, reservationBytes: 4 }),
      persistChild: vi.fn().mockResolvedValue(undefined),
      completeArchive: vi.fn().mockResolvedValue(undefined),
      transitionSource: vi.fn().mockResolvedValue(undefined),
      updateArchiveMetadata: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("streaming oversized archive worker", () => {
  it("rejects missing Cloud Tasks metadata and never claims a lease", async () => {
    const deps = dependencies();

    await expect(handleArchive({ body: payload, headers: {} }, deps)).resolves.toMatchObject({ status: 400 });
    expect(deps.lease.claim).not.toHaveBeenCalled();
  });

  it("rejects malformed or non-source payloads before loading storage", async () => {
    const deps = dependencies();

    await expect(handleArchive(request({ ...payload, kind: "discover_item" }), deps)).resolves.toMatchObject({ status: 400 });
    await expect(handleArchive(request("not-json"), deps)).resolves.toMatchObject({ status: 400 });
    expect(deps.source.get).not.toHaveBeenCalled();
  });

  it("streams an eligible source and never buffers it with download", async () => {
    const deps = dependencies();
    const source = await deps.source.get(payload.ownerId, payload.batchId, payload.resourceId);

    await expect(handleArchive(request(), deps)).resolves.toMatchObject({ status: 204 });
    expect(source?.createReadStream).toHaveBeenCalledOnce();
    expect(source && "download" in source).toBe(false);
    expect(deps.parser).toHaveBeenCalledOnce();
    expect(deps.persistence.persistChild).toHaveBeenCalledOnce();
  });

  it("uses unzipper's streaming parser for a real ZIP source", async () => {
    const zip = new JSZip();
    zip.file("font.ttf", Buffer.from([0, 1, 0, 0]));
    const bytes = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }));
    const source = awaitableSource();
    source.createReadStream = vi.fn(() => Readable.from([bytes]));
    const deps = dependencies({ source: { get: vi.fn().mockResolvedValue(source) }, parser: undefined });

    await expect(handleArchive(request(), deps)).resolves.toMatchObject({ status: 204 });
    expect(source.createReadStream).toHaveBeenCalledOnce();
    expect(deps.persistence.persistChild).toHaveBeenCalledOnce();
  });

  it.each([OVERSIZED_ARCHIVE_MIN_BYTES, OVERSIZED_ARCHIVE_MAX_BYTES + 1])
    ("rejects source size %s outside the oversized ZIP lane", async (declaredSize) => {
      const deps = dependencies({
        source: {
          get: vi.fn().mockResolvedValue({
            ...(awaitableSource()),
            declaredSize,
          }),
        },
      });

      await expect(handleArchive(request(), deps)).resolves.toMatchObject({ status: 400 });
      expect(deps.lease.claim).not.toHaveBeenCalled();
    });

  it("uses the shared archive policy, preserves reviews, and renews the lease while streaming", async () => {
    const deps = dependencies({
      parser: vi.fn(async function* () {
        yield {
          path: "../escape.ttf",
          type: "File",
          flags: 0,
          compressionMethod: 0,
          compressedSize: 4,
          uncompressedSize: 4,
          stream: () => Readable.from([Buffer.from("bad")]),
        };
        yield {
          path: "safe.ttf",
          type: "File",
          flags: 0,
          compressionMethod: 0,
          compressedSize: 4,
          uncompressedSize: 4,
          stream: () => Readable.from([Buffer.from([0, 1, 0, 0])]),
        };
      }),
    });

    await expect(handleArchive(request(), deps)).resolves.toMatchObject({ status: 204 });
    expect(deps.persistence.persistChild).toHaveBeenCalledOnce();
    expect(deps.persistence.completeArchive).toHaveBeenCalledWith(expect.objectContaining({ reviews: [expect.any(Object)] }));
    expect(deps.lease.renew.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not read or persist a policy-rejected entry beyond its bounded stream", async () => {
    const destroy = vi.fn();
    const deps = dependencies({
      parser: vi.fn(async function* () {
        yield {
          path: "too-large.ttf",
          type: "File",
          flags: 0,
          compressionMethod: 0,
          compressedSize: 100,
          uncompressedSize: 100,
          stream: () => Object.assign(Readable.from([Buffer.alloc(100)]), { destroy }),
        };
      }),
    });

    await expect(handleArchive(request(), deps)).resolves.toMatchObject({ status: 204 });
    expect(deps.persistence.persistChild).not.toHaveBeenCalled();
    expect(deps.persistence.completeArchive).toHaveBeenCalledWith(expect.objectContaining({ reviews: [expect.any(Object)] }));
  });
});

describe("archive worker packaging and setup", () => {
  it("uses a non-root Node 22 image and starts only the worker server", () => {
    const dockerfile = readFileSync(resolve(__dirname, "../../Dockerfile.archive-worker"), "utf8");
    expect(dockerfile).toContain("FROM node:22");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("lib/imports/archiveWorker/server.js");
  });

  it("prints the private Cloud Run setup without calling GCP in dry-run mode", () => {
    const script = resolve(__dirname, "../../../infra/import-pipeline/setup.sh");
    const output = execFileSync("bash", [script, "--project", "seriph", "--dry-run"], { encoding: "utf8" });
    expect(output).toContain("cloudtasks.googleapis.com");
    expect(output).toContain("seriph-import");
    expect(output).toContain("seriph-archive-worker");
    expect(output).toContain("--no-allow-unauthenticated");
    expect(output).toContain("--memory=1Gi");
    expect(output).toContain("--cpu=2");
    expect(output).toContain("--concurrency=1");
    expect(output).toContain("--timeout=900");
  });
});

function awaitableSource() {
  return {
    ...payload,
    sourceId: payload.resourceId,
    originalPath: "inbox.zip",
    filename: "inbox.zip",
    declaredSize: OVERSIZED_ARCHIVE_MIN_BYTES + 1,
    declaredMimeType: "application/zip",
    storagePath: "intake/owner-1/batch-1/source-1.zip",
    state: "uploaded" as const,
    createReadStream: vi.fn(() => Readable.from([Buffer.from("archive")])),
  };
}
