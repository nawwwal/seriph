import { createHash } from "node:crypto";
import { getFirestore, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import type { InventoryItem } from "../discovery/inventory";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { claimTaskLease } from "../tasks/lease";
import { importBatchRef, importSourceRef } from "../store/paths";
import { createItemOnce, completeArchiveIfReady, importItemRef, markArchiveInventoryDurableOnce } from "../store/itemStore";
import { reserveArchiveBytesOnce } from "../store/batchStore";
import { transitionSource, type SourceInput } from "../store/sourceStore";
import { getImportConfig } from "../config/importConfig";
import type { ArchiveDecision, ArchiveLimits } from "../discovery/archivePolicy";
import type { ArchiveChild } from "../discovery/discoverZip";
import type { ArchiveLease, ArchivePersistence, ArchiveSourceReader, ArchiveWorkerDependencies, RegisteredArchiveSource } from "./types";

const taskLeaseId = (taskName: string): string => createHash("sha256").update(taskName).digest("hex");
const sourceInput = (source: RegisteredArchiveSource): SourceInput => ({ ownerId: source.ownerId, batchId: source.batchId, sourceId: source.sourceId, originalPath: source.originalPath, filename: source.filename, declaredSize: source.declaredSize, declaredMimeType: source.declaredMimeType, storagePath: source.storagePath });
const pendingArchive = (source: RegisteredArchiveSource, itemId: string): InventoryItem => ({ ...sourceInput(source), archiveLineage: [], filename: source.filename, extension: ".zip", stagingPath: source.storagePath, itemId, sha256: "pending", byteSize: source.declaredSize, mimeType: "application/zip", format: "ZIP", detectedFormat: "ZIP", role: "archive", action: "expand", reasonCode: "archive_container" });

function leaseDurationMs(): number {
  const raw = process.env.IMPORT_TASK_LEASE_SECONDS ?? "300"; const seconds = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86_400) throw new Error("Invalid import task lease duration");
  return seconds * 1000;
}

function productionLease(db: Firestore): ArchiveLease {
  const refFor = (payload: ImportTaskPayload, name: string): DocumentReference => importBatchRef(db, payload.ownerId, payload.batchId).collection("tasks").doc(taskLeaseId(name));
  return {
    claim: (payload, name) => claimTaskLease(refFor(payload, name)),
    renew: (payload, name, attempt) => updateLease(db, refFor(payload, name), attempt, { leaseExpiresAt: new Date(Date.now() + leaseDurationMs()) }),
    fail: (payload, name, attempt, retryable = true) => updateLease(db, refFor(payload, name), attempt, { state: retryable ? "retryable" : "failed", leaseExpiresAt: new Date(), updatedAt: new Date() }),
    complete: (payload, name, attempt) => updateLease(db, refFor(payload, name), attempt, { state: "complete", completedAt: new Date(), leaseExpiresAt: new Date() }),
  };
}

async function updateLease(db: Firestore, ref: DocumentReference, attempt: number, update: Record<string, unknown>): Promise<void> {
  await db.runTransaction(async (tx) => { const snap = await tx.get(ref); const current = snap.exists ? snap.data() as Record<string, unknown> : undefined;
    if (!current || current.attempt !== attempt || current.state !== "leased") return;
    tx.update(ref, update as never); });
}

function productionSource(db: Firestore, storage: Storage): ArchiveSourceReader {
  return { get: async (ownerId, batchId, sourceId) => { const snap = await importSourceRef(db, ownerId, batchId, sourceId).get(); if (!snap.exists) return undefined; const source = snap.data() as RegisteredArchiveSource; return { ...source, createReadStream: () => storage.bucket().file(source.storagePath).createReadStream() }; } };
}

function productionPersistence(db: Firestore, storage: Storage): ArchivePersistence {
  return {
    createArchive: async (source, itemId) => { await createItemOnce(db, pendingArchive(source, itemId)); },
    reserve: async (input) => { const result = await reserveArchiveBytesOnce(db, input); if (result.kind === "batch_missing") throw new Error("import batch missing while reserving archive bytes"); return result; },
    persistChild: async (child) => { const result = await createItemOnce(db, { ...child.inventory, stagingPath: child.staging.path }); if (result.kind === "batch_missing") throw new Error("import batch missing while persisting archive child"); await storage.bucket().file(child.staging.path).save(child.staging.bytes, { resumable: false, metadata: { contentType: child.inventory.mimeType } }); await enqueueImportTask(child.task); },
    completeArchive: async ({ ownerId, batchId, itemId, expectedChildren, reviews }) => { await markArchiveInventoryDurableOnce(db, { ownerId, batchId, itemId, expectedChildren, reviewCount: reviews.length, reviewEntries: reviews.map((entry) => ({ path: entry.entryPath, reasonCode: entry.reasonCode, parentItemId: entry.parentItemId ?? itemId, lineage: entry.lineage ?? [{ archiveItemId: itemId, entryPath: entry.entryPath }] })) }); await completeArchiveIfReady(db, { ownerId, batchId, itemId }); },
    transitionSource: async (source, from, to) => { await transitionSource(db, sourceInput(source), from, to); },
    updateArchiveMetadata: async ({ ownerId, batchId, itemId, sha256, byteSize }) => { await db.runTransaction(async (tx) => { const ref = importItemRef(db, ownerId, batchId, itemId); if ((await tx.get(ref)).exists) tx.update(ref, { sha256, contentHash: sha256, byteSize, updatedAt: new Date() }); }); },
  };
}

export function productionArchiveWorkerDependencies(): ArchiveWorkerDependencies {
  const db = getFirestore(); const storage = getStorage(); const config = getImportConfig();
  const limits: ArchiveLimits = { maxDepth: config.archiveMaxDepth, maxEntries: config.archiveMaxEntries, maxExpandedBatchBytes: config.archiveMaxExpandedBatchBytes, maxEntryBytes: config.archiveMaxEntryBytes, maxCompressionRatio: config.archiveMaxCompressionRatio, maxPathBytes: config.archiveMaxPathBytes };
  return { source: productionSource(db, storage), lease: productionLease(db), persistence: productionPersistence(db, storage), queueName: process.env.IMPORT_TASKS_QUEUE ?? "seriph-import", limits };
}
