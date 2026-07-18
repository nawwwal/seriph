import { Readable } from "node:stream";
import { vi } from "vitest";
import { OVERSIZED_ARCHIVE_MIN_BYTES, type ArchiveWorkerDependencies } from "../../src/imports/archiveWorker/handleArchive";

export const archivePayload = { kind: "discover_source" as const, ownerId: "owner-1", batchId: "batch-1", resourceId: "source-1", planVersion: 1 };
export const archiveHeaders = { "x-cloudtasks-taskname": "projects/seriph/locations/asia-southeast1/queues/seriph-import/tasks/task-1", "x-cloudtasks-queuename": "seriph-import" };
export const archiveLimits = { maxDepth: 4, maxEntries: 100, maxExpandedBatchBytes: 100, maxEntryBytes: 50, maxCompressionRatio: 100, maxPathBytes: 1024 };

export function testSource(overrides: Record<string, unknown> = {}) {
  return { ...archivePayload, sourceId: archivePayload.resourceId, originalPath: "inbox.zip", filename: "inbox.zip", declaredSize: 11,
    declaredMimeType: "application/zip", storagePath: "intake/owner-1/batch-1/source-1.zip", state: "uploaded" as const,
    createReadStream: vi.fn(() => Readable.from([Buffer.from("PK\x03\x04archive", "binary")])), ...overrides };
}

export function testDependencies(source = testSource(), overrides: Partial<ArchiveWorkerDependencies> = {}): ArchiveWorkerDependencies {
  return { limits: archiveLimits, source: { get: vi.fn().mockResolvedValue(source) },
    parser: vi.fn(async function* (stream) { stream.resume(); yield { path: "font.ttf", type: "File", flags: 0, compressionMethod: 0, compressedSize: 4, uncompressedSize: 4, stream: () => Readable.from([Buffer.from([0, 1, 0, 0])]) }; }),
    lease: { claim: vi.fn().mockResolvedValue({ kind: "claimed", attempt: 1 }), renew: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined), complete: vi.fn().mockResolvedValue(undefined) } as never,
    persistence: { createArchive: vi.fn().mockResolvedValue(undefined), reserve: vi.fn().mockResolvedValue({ kind: "reserved", remainingBytes: 96, reservationBytes: 4 }), persistChild: vi.fn().mockResolvedValue(undefined), completeArchive: vi.fn().mockResolvedValue(undefined), transitionSource: vi.fn().mockResolvedValue(undefined), updateArchiveMetadata: vi.fn().mockResolvedValue(undefined) },
    oversizedMinBytes: 0, oversizedMaxBytes: Number.MAX_SAFE_INTEGER, ...overrides,
  };
}
