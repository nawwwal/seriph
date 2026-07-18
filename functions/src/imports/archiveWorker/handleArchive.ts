import { createHash } from "node:crypto";
import { assessArchiveEntry, review, type ArchiveDecision } from "../discovery/archivePolicy";
import { archiveStagingPath } from "../discovery/archivePaths";
import { extractEntryBounded, type ArchiveChild } from "../discovery/discoverZip";
import { buildInventoryItem, type InventoryInput } from "../discovery/inventory";
import { canonicalizeImportTaskPayload, type ImportTaskPayload } from "../tasks/enqueue";
import { ArchiveSourceTooLargeError, drain, defaultParser, observe, sourceLooksLikeZip, validateSource } from "./stream";
import { productionArchiveWorkerDependencies } from "./persistence";
import type { ArchiveWorkerDependencies, ArchiveWorkerRequest, ArchiveWorkerResult, RegisteredArchiveSource } from "./types";
export * from "./types";
export { productionArchiveWorkerDependencies } from "./persistence";

const taskName = (request: ArchiveWorkerRequest): string | undefined => {
  const value = request.headers?.["x-cloudtasks-taskname"] ?? request.headers?.["X-CloudTasks-TaskName"];
  return (Array.isArray(value) ? value[0] : value)?.trim();
};
const queueName = (request: ArchiveWorkerRequest): string | undefined => {
  const value = request.headers?.["x-cloudtasks-queuename"] ?? request.headers?.["X-CloudTasks-QueueName"];
  return Array.isArray(value) ? value[0] : value;
};
const bodyValue = (body: unknown): unknown => {
  if (typeof body !== "string" && !Buffer.isBuffer(body)) return body;
  try { return JSON.parse(Buffer.from(body).toString("utf8")); } catch { return undefined; }
};
const archiveId = (source: RegisteredArchiveSource): string => `item-${createHash("sha256").update(JSON.stringify({ ownerId: source.ownerId, batchId: source.batchId, sourceId: source.sourceId, storagePath: source.storagePath })).digest("hex")}`;
const validTaskName = (name: string, queue: string): boolean => new RegExp(`^projects/[^/]+/locations/[^/]+/queues/${queue.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/tasks/[^/]+$`).test(name);
function childFor(source: RegisteredArchiveSource, archiveItemId: string, entryPath: string, bytes: Buffer): { input: InventoryInput; staging: ArchiveChild["staging"]; task: ImportTaskPayload } {
  const safePath = entryPath.normalize("NFKC").replace(/\\/g, "/"); const filename = safePath.split("/").pop()!;
  return { input: { ownerId: source.ownerId, batchId: source.batchId, sourceId: source.sourceId, originalPath: source.originalPath, archiveLineage: [{ archiveItemId, entryPath }], filename, extension: filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase()}` : "", declaredMimeType: "application/octet-stream", bytes, name: safePath },
    staging: { path: archiveStagingPath({ ownerId: source.ownerId, batchId: source.batchId, archiveItemId, entryPath: safePath }), bytes, contentHash: "" },
    task: { kind: "discover_item", ownerId: source.ownerId, batchId: source.batchId, resourceId: "", planVersion: 1, archiveBudgetKey: source.batchId } };
}

const sourceSize = (source: RegisteredArchiveSource, payload: ImportTaskPayload): number => source.uploadedSize ?? payload.sourceSize ?? source.declaredSize;
const rejectSource = async (deps: ArchiveWorkerDependencies, source: RegisteredArchiveSource, code: string): Promise<ArchiveWorkerResult> => {
  await deps.persistence.transitionSource(source, source.state as "uploaded" | "discovering", "failed");
  return { status: 400, body: { code } };
};

export async function handleArchive(request: ArchiveWorkerRequest, deps: ArchiveWorkerDependencies = productionArchiveWorkerDependencies()): Promise<ArchiveWorkerResult> {
  const name = taskName(request); const queue = queueName(request); const expectedQueue = deps.queueName ?? "seriph-import";
  if (!name || !queue || queue !== expectedQueue || !validTaskName(name, queue)) return { status: 400, body: { code: "missing_task_metadata" } };
  let payload: ImportTaskPayload;
  try { payload = canonicalizeImportTaskPayload(bodyValue(request.body)); } catch { return { status: 400, body: { code: "invalid_task_payload" } }; }
  if (payload.kind !== "discover_source") return { status: 400, body: { code: "unsupported_task_kind" } };
  const source = await deps.source.get(payload.ownerId, payload.batchId, payload.resourceId);
  if (!source || !["uploaded", "discovering"].includes(source.state)) return { status: 204 };
  const minBytes = deps.oversizedMinBytes ?? 150 * 1024 * 1024; const maxBytes = deps.oversizedMaxBytes ?? 512 * 1024 * 1024; const expectedSize = sourceSize(source, payload);
  if (expectedSize <= minBytes || expectedSize > maxBytes || !sourceLooksLikeZip(source, Buffer.from("PK\x03\x04", "binary"))) return rejectSource(deps, source, "source_not_eligible");
  let validation: Awaited<ReturnType<typeof validateSource>>;
  try { validation = await validateSource(source, expectedSize, maxBytes); } catch (error) {
    if (error instanceof ArchiveSourceTooLargeError) return rejectSource(deps, source, error.code);
    return { status: 503, body: { code: error instanceof Error ? error.message : "archive_source_read_failure", retryable: true } };
  }
  if ("code" in validation) return rejectSource(deps, source, validation.code);
  const lease = await deps.lease.claim(payload, name); if (lease.kind !== "claimed") return { status: 204 };
  const itemId = archiveId(source); const reviews: ArchiveDecision[] = []; const seen = new Set<string>(); let expanded = 0; let children = 0; let overLimit = false;
  try {
    if (source.state === "uploaded") await deps.persistence.transitionSource(source, "uploaded", "discovering");
    await deps.persistence.createArchive(source, itemId); await deps.lease.renew(payload, name, lease.attempt);
    const observed = observe(source.createReadStream(), maxBytes); const parser = deps.parser ?? defaultParser;
    let entryCount = 0;
    for await (const entry of parser(observed.stream)) {
      entryCount += 1;
      if (entryCount > deps.limits.maxEntries) { if (!overLimit) reviews.push({ ...review("", "entry_limit"), parentItemId: itemId }); overLimit = true; await drain(entry, deps.limits.maxEntryBytes); continue; }
      const decision = assessArchiveEntry({ ...entry, entryPath: entry.path }, deps.limits, expanded);
      if (entry.type === "Directory" && decision.action === "stage") { await drain(entry, deps.limits.maxEntryBytes); continue; }
      if (decision.action === "review") { reviews.push({ ...decision, parentItemId: itemId }); await drain(entry, deps.limits.maxEntryBytes); continue; }
      if (seen.has(decision.normalizedPath!)) { reviews.push({ ...review(entry.path, "path_collision"), parentItemId: itemId }); await drain(entry, deps.limits.maxEntryBytes); continue; }
      const reservation = await deps.persistence.reserve({ ownerId: source.ownerId, batchId: source.batchId, reservationId: `${itemId}:${entry.path}`, bytes: entry.uncompressedSize, maxBytes: deps.limits.maxExpandedBatchBytes });
      if (reservation.kind === "exceeded") { reviews.push({ ...review(entry.path, "expanded_size"), parentItemId: itemId }); await drain(entry, deps.limits.maxEntryBytes); continue; }
      const extracted = await extractEntryBounded(entry, deps.limits.maxEntryBytes, reservation.remainingBytes + reservation.reservationBytes);
      if (!Buffer.isBuffer(extracted)) { reviews.push({ ...extracted, parentItemId: itemId }); continue; }
      const child = childFor(source, itemId, decision.normalizedPath!, extracted); const inventory = await buildInventoryItem(child.input);
      const finalChild = { ...child, inventory: { ...inventory, stagingPath: child.staging.path }, staging: { ...child.staging, contentHash: inventory.sha256 }, task: { ...child.task, resourceId: inventory.itemId } };
      await deps.persistence.persistChild(finalChild); seen.add(decision.normalizedPath!); expanded += extracted.byteLength; children += 1; await deps.lease.renew(payload, name, lease.attempt);
    }
    const metadata = await observed.complete;
    if (metadata.byteSize !== expectedSize) { await deps.lease.fail(payload, name, lease.attempt, false); return { status: 400, body: { code: "source_size_mismatch" } }; }
    if (!sourceLooksLikeZip(source, metadata.prefix)) { await deps.lease.fail(payload, name, lease.attempt, false); return { status: 400, body: { code: "source_not_zip" } }; }
    await deps.persistence.updateArchiveMetadata({ ownerId: source.ownerId, batchId: source.batchId, itemId, sha256: metadata.sha256, byteSize: metadata.byteSize });
    await deps.persistence.completeArchive({ ownerId: source.ownerId, batchId: source.batchId, itemId, expectedChildren: children, reviews });
    await deps.persistence.transitionSource(source, "discovering", "discovered"); await deps.lease.complete(payload, name, lease.attempt); return { status: 204 };
  } catch (error) {
    if (error instanceof ArchiveSourceTooLargeError) {
      await deps.persistence.transitionSource(source, "discovering", "failed"); await deps.lease.fail(payload, name, lease.attempt, false);
      return { status: 400, body: { code: error.code } };
    }
    await deps.lease.fail(payload, name, lease.attempt, true); return { status: 503, body: { code: error instanceof Error ? error.message : "archive_worker_failure", retryable: true } };
  }
}
