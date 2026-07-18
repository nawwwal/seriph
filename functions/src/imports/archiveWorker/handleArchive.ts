import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import * as unzipper from "unzipper";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { buildInventoryItem, type InventoryItem } from "../discovery/inventory";
import { assessArchiveEntry, review, type ArchiveDecision, type ArchiveEntryMetadata, type ArchiveLimits } from "../discovery/archivePolicy";
import { archiveStagingPath } from "../discovery/archivePaths";
import { extractEntryBounded, type ArchiveChild } from "../discovery/discoverZip";
import { canonicalizeImportTaskPayload, enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { claimTaskLease } from "../tasks/lease";
import { importBatchRef, importSourceRef } from "../store/paths";
import { createItemOnce, completeArchiveIfReady, importItemRef, markArchiveInventoryDurableOnce } from "../store/itemStore";
import { reserveArchiveBytesOnce } from "../store/batchStore";
import { transitionSource, type SourceInput } from "../store/sourceStore";
import { getImportConfig } from "../config/importConfig";

export const OVERSIZED_ARCHIVE_MIN_BYTES = 150 * 1024 * 1024;
export const OVERSIZED_ARCHIVE_MAX_BYTES = 512 * 1024 * 1024;

export interface ArchiveWorkerRequest {
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

export interface RegisteredArchiveSource extends SourceInput {
  sourceId: string;
  state: "registered" | "uploading" | "uploaded" | "discovering" | "discovered" | "failed" | "canceled" | "timed_out";
  declaredSize: number;
  createReadStream: () => NodeJS.ReadableStream | AsyncIterable<Uint8Array>;
}

export interface ArchiveSourceReader {
  get: (ownerId: string, batchId: string, sourceId: string) => Promise<RegisteredArchiveSource | undefined>;
}

export interface ArchiveStreamEntry extends Omit<ArchiveEntryMetadata, "entryPath"> {
  path: string;
  type?: string;
  stream: () => AsyncIterable<Uint8Array>;
}

export type ArchiveParser = (source: NodeJS.ReadableStream) => AsyncIterable<ArchiveStreamEntry>;

export interface ArchiveLease {
  claim: (payload: ImportTaskPayload, taskName: string) => Promise<{ kind: "claimed"; attempt: number } | { kind: "busy" }>;
  renew: (payload: ImportTaskPayload, taskName: string, attempt: number) => Promise<void>;
}

export interface ArchiveReservation {
  kind: "reserved" | "exists" | "exceeded";
  remainingBytes: number;
  reservationBytes: number;
}

export interface ArchivePersistence {
  createArchive: (source: RegisteredArchiveSource, archiveItemId: string) => Promise<void>;
  reserve: (input: { ownerId: string; batchId: string; reservationId: string; bytes: number; maxBytes: number }) => Promise<ArchiveReservation>;
  persistChild: (child: ArchiveChild) => Promise<void>;
  completeArchive: (input: { ownerId: string; batchId: string; itemId: string; expectedChildren: number; reviews: ArchiveDecision[] }) => Promise<void>;
  transitionSource: (source: RegisteredArchiveSource, from: "uploaded" | "discovering", to: "discovering" | "discovered") => Promise<void>;
  updateArchiveMetadata: (input: { ownerId: string; batchId: string; itemId: string; sha256: string; byteSize: number }) => Promise<void>;
}

export interface ArchiveWorkerDependencies {
  source: ArchiveSourceReader;
  parser?: ArchiveParser;
  lease: ArchiveLease;
  persistence: ArchivePersistence;
  limits: ArchiveLimits;
  queueName?: string;
}

export interface ArchiveWorkerResult {
  status: 204 | 400 | 503;
  body?: { code: string; retryable?: boolean };
}

const header = (headers: ArchiveWorkerRequest["headers"], name: string): string | undefined => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()] ?? headers?.[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseBody = (body: unknown): unknown => {
  if (typeof body !== "string" && !Buffer.isBuffer(body)) return body;
  try { return JSON.parse(Buffer.from(body).toString("utf8")); } catch { return undefined; }
};

const taskNameFrom = (request: ArchiveWorkerRequest): string | undefined => header(request.headers, "x-cloudtasks-taskname")?.trim();

function validTaskName(taskName: string, queueName: string): boolean {
  return new RegExp(`^projects/[^/]+/locations/[^/]+/queues/${queueName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/tasks/[^/]+$`).test(taskName);
}

function archiveItemId(source: RegisteredArchiveSource): string {
  const identity = JSON.stringify({ ownerId: source.ownerId, batchId: source.batchId, sourceId: source.sourceId, storagePath: source.storagePath });
  return `item-${createHash("sha256").update(identity).digest("hex")}`;
}

const taskLeaseId = (taskName: string): string => createHash("sha256").update(taskName).digest("hex");

function sourceInput(source: RegisteredArchiveSource): SourceInput {
  return {
    ownerId: source.ownerId, batchId: source.batchId, sourceId: source.sourceId,
    originalPath: source.originalPath, filename: source.filename, declaredSize: source.declaredSize,
    declaredMimeType: source.declaredMimeType, storagePath: source.storagePath,
  };
}

function observe(source: NodeJS.ReadableStream | AsyncIterable<Uint8Array>): {
  stream: NodeJS.ReadableStream;
  complete: Promise<{ sha256: string; byteSize: number }>;
} {
  const input = "pipe" in source ? source : Readable.from(source);
  const hash = createHash("sha256");
  let byteSize = 0;
  let resolveComplete!: (value: { sha256: string; byteSize: number }) => void;
  let rejectComplete!: (error: unknown) => void;
  const complete = new Promise<{ sha256: string; byteSize: number }>((resolve, reject) => {
    resolveComplete = resolve; rejectComplete = reject;
  });
  const output = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const bytes = Buffer.from(chunk);
      hash.update(bytes); byteSize += bytes.byteLength; callback(null, bytes);
    },
    flush(callback) {
      resolveComplete({ sha256: hash.digest("hex"), byteSize }); callback();
    },
  });
  input.once("error", rejectComplete);
  output.once("error", rejectComplete);
  (input as NodeJS.ReadableStream & { pipe: (destination: NodeJS.WritableStream) => unknown }).pipe(output);
  return { stream: output, complete };
}

function defaultParser(source: NodeJS.ReadableStream): AsyncIterable<ArchiveStreamEntry> {
  const parser = unzipper.Parse({ forceStream: true });
  (source as NodeJS.ReadableStream & { pipe: (destination: NodeJS.WritableStream) => unknown }).pipe(parser);
  return (async function* () {
    for await (const raw of parser as AsyncIterable<Record<string, any>>) {
      const values = raw.vars ?? raw;
      yield {
        path: raw.path,
        type: raw.type ?? values.type,
        flags: Number(values.flags ?? raw.flags ?? 0),
        compressionMethod: Number(values.compressionMethod ?? raw.compressionMethod ?? 0),
        compressedSize: Number(values.compressedSize ?? raw.compressedSize ?? 0),
        uncompressedSize: Number(values.uncompressedSize ?? raw.uncompressedSize ?? 0),
        versionMadeBy: values.versionMadeBy ?? raw.versionMadeBy,
        externalFileAttributes: values.externalFileAttributes ?? raw.externalFileAttributes,
        stream: () => raw as unknown as AsyncIterable<Uint8Array>,
      };
    }
  })();
}

function pendingArchive(source: RegisteredArchiveSource, itemId: string): InventoryItem {
  return {
    ...sourceInput(source), archiveLineage: [], filename: source.filename,
    extension: ".zip", stagingPath: source.storagePath, itemId, sha256: "pending", byteSize: source.declaredSize,
    mimeType: "application/zip", format: "ZIP", detectedFormat: "ZIP", role: "archive", action: "expand",
    reasonCode: "archive_container",
  };
}

async function renew(deps: ArchiveWorkerDependencies, payload: ImportTaskPayload, taskName: string, attempt: number): Promise<void> {
  await deps.lease.renew(payload, taskName, attempt);
}

function context(decision: ArchiveDecision, archiveItemIdValue: string, lineage: Array<{ archiveItemId: string; entryPath: string }>): ArchiveDecision {
  return { ...decision, parentItemId: archiveItemIdValue, lineage: [...lineage, { archiveItemId: archiveItemIdValue, entryPath: decision.entryPath }] };
}

export async function handleArchive(request: ArchiveWorkerRequest, deps: ArchiveWorkerDependencies): Promise<ArchiveWorkerResult> {
  const taskName = taskNameFrom(request);
  const queueName = header(request.headers, "x-cloudtasks-queuename");
  if (!taskName || !queueName || queueName !== (deps.queueName ?? "seriph-import") || !validTaskName(taskName, queueName)) return { status: 400, body: { code: "missing_task_metadata" } };
  let payload: ImportTaskPayload;
  try { payload = canonicalizeImportTaskPayload(parseBody(request.body)); } catch { return { status: 400, body: { code: "invalid_task_payload" } }; }
  if (payload.kind !== "discover_source") return { status: 400, body: { code: "unsupported_task_kind" } };

  const source = await deps.source.get(payload.ownerId, payload.batchId, payload.resourceId);
  if (!source || !["uploaded", "discovering"].includes(source.state)) return { status: 204 };
  if (!Number.isSafeInteger(source.declaredSize) || source.declaredSize <= OVERSIZED_ARCHIVE_MIN_BYTES || source.declaredSize > OVERSIZED_ARCHIVE_MAX_BYTES) {
    return { status: 400, body: { code: "source_size_out_of_range" } };
  }
  const lease = await deps.lease.claim(payload, taskName);
  if (lease.kind !== "claimed") return { status: 204 };

  const archiveItemIdValue = archiveItemId(source);
  const lineage: Array<{ archiveItemId: string; entryPath: string }> = [];
  const reviews: ArchiveDecision[] = [];
  let expandedBytes = 0;
  let expectedChildren = 0;
  const seenPaths = new Set<string>();
  try {
    if (source.state === "uploaded") await deps.persistence.transitionSource(source, "uploaded", "discovering");
    await deps.persistence.createArchive(source, archiveItemIdValue);
    await renew(deps, payload, taskName, lease.attempt);
    const observed = observe(source.createReadStream());
    const parser = deps.parser ?? defaultParser;
    for await (const entry of parser(observed.stream)) {
      const decision = assessArchiveEntry({ ...entry, entryPath: entry.path }, deps.limits, expandedBytes);
      if (entry.type === "Directory" && decision.action === "stage") continue;
      const scopedDecision = context(decision, archiveItemIdValue, lineage);
      if (decision.action === "review") { reviews.push(scopedDecision); continue; }
      if (decision.normalizedPath && seenPaths.has(decision.normalizedPath)) {
        reviews.push(context(review(entry.path, "path_collision"), archiveItemIdValue, lineage));
        continue;
      }
      const reservation = await deps.persistence.reserve({
        ownerId: payload.ownerId, batchId: payload.batchId,
        reservationId: `${archiveItemIdValue}:${entry.path}`, bytes: entry.uncompressedSize,
        maxBytes: deps.limits.maxExpandedBatchBytes,
      });
      if (reservation.kind === "exceeded") { reviews.push(context(review(entry.path, "expanded_size"), archiveItemIdValue, lineage)); continue; }
      const extracted = await extractEntryBounded(
        entry, deps.limits.maxEntryBytes,
        reservation.remainingBytes + reservation.reservationBytes,
      );
      if (!Buffer.isBuffer(extracted)) { reviews.push(context(extracted, archiveItemIdValue, lineage)); continue; }
      if (decision.normalizedPath) seenPaths.add(decision.normalizedPath);
      expandedBytes += extracted.byteLength;
      const safePath = decision.normalizedPath!;
      const childLineage = [...lineage, { archiveItemId: archiveItemIdValue, entryPath: entry.path }];
      const inventory = await buildInventoryItem({
        ownerId: payload.ownerId, batchId: payload.batchId, sourceId: source.sourceId,
        originalPath: source.originalPath, archiveLineage: childLineage,
        filename: safePath.split("/").pop()!, extension: safePath.includes(".") ? `.${safePath.split(".").pop()!.toLowerCase()}` : "",
        declaredMimeType: "application/octet-stream", bytes: extracted, name: safePath,
      });
      const stagingPath = archiveStagingPath({ ownerId: payload.ownerId, batchId: payload.batchId, archiveItemId: archiveItemIdValue, entryPath: safePath });
      const child: ArchiveChild = {
        inventory: { ...inventory, stagingPath },
        staging: { path: stagingPath, bytes: extracted, contentHash: inventory.sha256 },
        task: { kind: "discover_item", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: inventory.itemId, planVersion: 1, archiveBudgetKey: payload.batchId },
      };
      await deps.persistence.persistChild(child);
      expectedChildren += 1;
      await renew(deps, payload, taskName, lease.attempt);
    }
    const metadata = await (deps.parser ? Promise.resolve({ sha256: "streamed", byteSize: source.declaredSize }) : observed.complete);
    await deps.persistence.updateArchiveMetadata({ ownerId: payload.ownerId, batchId: payload.batchId, itemId: archiveItemIdValue, ...metadata });
    await deps.persistence.completeArchive({ ownerId: payload.ownerId, batchId: payload.batchId, itemId: archiveItemIdValue, expectedChildren, reviews });
    await deps.persistence.transitionSource(source, "discovering", "discovered");
    await renew(deps, payload, taskName, lease.attempt);
    return { status: 204 };
  } catch (error) {
    return { status: 503, body: { code: error instanceof Error ? error.message : "archive_worker_failure", retryable: true } };
  }
}

function leaseDurationMs(): number {
  const raw = process.env.IMPORT_TASK_LEASE_SECONDS ?? "300";
  const seconds = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86_400) throw new Error("Invalid import task lease duration");
  return seconds * 1000;
}

function productionLease(db: Firestore): ArchiveLease {
  return {
    claim: (payload, taskName) => claimTaskLease(importBatchRef(db, payload.ownerId, payload.batchId).collection("tasks").doc(taskLeaseId(taskName))),
    renew: async (payload, taskName, attempt) => {
      const ref = importBatchRef(db, payload.ownerId, payload.batchId).collection("tasks").doc(taskLeaseId(taskName));
      const now = new Date();
      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref); const current = snapshot.exists ? snapshot.data() as Record<string, unknown> : undefined;
        if (!current || current.state !== "leased" || current.attempt !== attempt) throw new Error("Import task lease is no longer owned");
        tx.update(ref, { leaseStartedAt: current.leaseStartedAt ?? now, leaseExpiresAt: new Date(now.getTime() + leaseDurationMs()) });
      });
    },
  };
}

function productionSource(db: Firestore, storage: Storage): ArchiveSourceReader {
  return { get: async (ownerId, batchId, sourceId) => {
    const ref = importSourceRef(db, ownerId, batchId, sourceId); const snapshot = await ref.get();
    if (!snapshot.exists) return undefined;
    const source = snapshot.data() as RegisteredArchiveSource;
    return { ...source, createReadStream: () => storage.bucket().file(source.storagePath).createReadStream() };
  } };
}

function productionPersistence(db: Firestore, storage: Storage): ArchivePersistence {
  return {
    createArchive: async (source, itemId) => { await createItemOnce(db, pendingArchive(source, itemId)); },
    reserve: async (input) => {
      const result = await reserveArchiveBytesOnce(db, input);
      if (result.kind === "batch_missing") throw new Error("import batch missing while reserving archive bytes");
      return result;
    },
    persistChild: async (child) => {
      const result = await createItemOnce(db, { ...child.inventory, stagingPath: child.staging.path });
      if (result.kind === "batch_missing") throw new Error("import batch missing while persisting archive child");
      await storage.bucket().file(child.staging.path).save(child.staging.bytes, { resumable: false, metadata: { contentType: child.inventory.mimeType } });
      await enqueueImportTask(child.task);
    },
    completeArchive: async ({ ownerId, batchId, itemId, expectedChildren, reviews }) => {
      await markArchiveInventoryDurableOnce(db, { ownerId, batchId, itemId, expectedChildren, reviewCount: reviews.length, reviewEntries: reviews.map((entry) => ({
        path: entry.entryPath, reasonCode: entry.reasonCode, parentItemId: entry.parentItemId ?? itemId,
        lineage: entry.lineage ?? [{ archiveItemId: itemId, entryPath: entry.entryPath }],
      })) });
      await completeArchiveIfReady(db, { ownerId, batchId, itemId });
    },
    transitionSource: async (source, from, to) => { await transitionSource(db, sourceInput(source), from, to); },
    updateArchiveMetadata: async ({ ownerId, batchId, itemId, sha256, byteSize }) => {
      await db.runTransaction(async (tx) => {
        const ref = importItemRef(db, ownerId, batchId, itemId); if ((await tx.get(ref)).exists) tx.update(ref, { sha256, contentHash: sha256, byteSize, updatedAt: new Date() });
      });
    },
  };
}

export function productionArchiveWorkerDependencies(): ArchiveWorkerDependencies {
  const db = getFirestore(); const storage = getStorage(); const config = getImportConfig();
  return {
    source: productionSource(db, storage), lease: productionLease(db), persistence: productionPersistence(db, storage),
    queueName: process.env.IMPORT_TASKS_QUEUE ?? "seriph-import",
    limits: { maxDepth: config.archiveMaxDepth, maxEntries: config.archiveMaxEntries, maxExpandedBatchBytes: config.archiveMaxExpandedBatchBytes,
      maxEntryBytes: config.archiveMaxEntryBytes, maxCompressionRatio: config.archiveMaxCompressionRatio, maxPathBytes: config.archiveMaxPathBytes },
  };
}
