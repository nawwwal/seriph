import type { ArchiveChild } from "../discovery/discoverZip";
import type { ArchiveDecision, ArchiveEntryMetadata, ArchiveLimits } from "../discovery/archivePolicy";
import type { SourceInput } from "../store/sourceStore";
import type { ImportTaskPayload } from "../tasks/enqueue";

export const OVERSIZED_ARCHIVE_MIN_BYTES = 150 * 1024 * 1024;
export const OVERSIZED_ARCHIVE_MAX_BYTES = 512 * 1024 * 1024;

export interface ArchiveWorkerRequest { body: unknown; headers?: Record<string, string | string[] | undefined>; }
export interface RegisteredArchiveSource extends SourceInput {
  uploadedSize?: number;
  sourceId: string; state: "registered" | "uploading" | "uploaded" | "discovering" | "discovered" | "failed" | "canceled" | "timed_out";
  declaredSize: number; createReadStream: () => NodeJS.ReadableStream | AsyncIterable<Uint8Array>;
}
export interface ArchiveSourceReader { get: (ownerId: string, batchId: string, sourceId: string) => Promise<RegisteredArchiveSource | undefined>; }
export interface ArchiveStreamEntry extends Omit<ArchiveEntryMetadata, "entryPath"> { path: string; type?: string; stream: () => AsyncIterable<Uint8Array>; }
export type ArchiveParser = (source: NodeJS.ReadableStream) => AsyncIterable<ArchiveStreamEntry>;
export interface ArchiveLease {
  claim: (payload: ImportTaskPayload, taskName: string) => Promise<{ kind: "claimed"; attempt: number } | { kind: "busy" }>;
  renew: (payload: ImportTaskPayload, taskName: string, attempt: number) => Promise<void>;
  fail: (payload: ImportTaskPayload, taskName: string, attempt: number, retryable?: boolean) => Promise<void>;
  complete: (payload: ImportTaskPayload, taskName: string, attempt: number) => Promise<void>;
}
export interface ArchiveReservation { kind: "reserved" | "exists" | "exceeded"; remainingBytes: number; reservationBytes: number; }
export interface ArchivePersistence {
  createArchive: (source: RegisteredArchiveSource, archiveItemId: string) => Promise<void>;
  reserve: (input: { ownerId: string; batchId: string; reservationId: string; bytes: number; maxBytes: number }) => Promise<ArchiveReservation>;
  persistChild: (child: ArchiveChild) => Promise<void>;
  completeArchive: (input: { ownerId: string; batchId: string; itemId: string; expectedChildren: number; reviews: ArchiveDecision[] }) => Promise<void>;
  transitionSource: (source: RegisteredArchiveSource, from: "uploaded" | "discovering", to: "discovering" | "discovered" | "failed") => Promise<void>;
  updateArchiveMetadata: (input: { ownerId: string; batchId: string; itemId: string; sha256: string; byteSize: number }) => Promise<void>;
}
export interface ArchiveWorkerDependencies { source: ArchiveSourceReader; parser?: ArchiveParser; lease: ArchiveLease; persistence: ArchivePersistence; limits: ArchiveLimits; queueName?: string; oversizedMinBytes?: number; oversizedMaxBytes?: number; }
export interface ArchiveWorkerResult { status: 204 | 400 | 413 | 503; body?: { code: string; retryable?: boolean }; }
