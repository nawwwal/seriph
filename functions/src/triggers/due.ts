import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { getImportConfig } from "../imports/config/importConfig";
import { enqueueImportTask, type ImportTaskPayload } from "../imports/tasks/enqueue";
import { deliverPendingDispatch, pendingDispatch } from "../imports/reconcile/pendingDispatch";
import { DUE_EVENT_OPTIONS } from "../options";

type Data = Record<string, unknown> | undefined;
type TimedValue = { toMillis(): number } | Date | number | string | undefined;

function millis(value: TimedValue): number | undefined {
  if (value && typeof value === "object" && "toMillis" in value) return value.toMillis();
  const date = value instanceof Date ? value : new Date(value as string | number);
  const result = date.getTime();
  return Number.isFinite(result) ? result : undefined;
}

function validData(data: Data): data is Record<string, unknown> {
  return Boolean(data && typeof data.ownerId === "string" && typeof data.batchId === "string");
}

function enrichmentDue(before: Data, after: Data, observedAtMs: number): number | undefined {
  if (!after) return undefined;
  if (after.state === "queued" && before?.state !== "queued") return observedAtMs;
  if (after.state === "retrying") {
    const due = millis(after.retryAt as TimedValue);
    if (before?.state !== "retrying" || millis(before.retryAt as TimedValue) !== due) return due ?? observedAtMs;
  }
  const leased = ["rendering", "submitting", "submitted", "analyzing", "embedding", "indexing"];
  if (leased.includes(String(after.state)) && typeof after.leaseId === "string"
    && (before?.leaseId !== after.leaseId || millis(before?.leaseExpiresAt as TimedValue) !== millis(after.leaseExpiresAt as TimedValue))) {
    return millis(after.leaseExpiresAt as TimedValue);
  }
  return undefined;
}

async function queue(payload: ImportTaskPayload): Promise<void> {
  await enqueueImportTask(payload);
}

export const queueEnrichmentJob = onDocumentWritten({
  ...DUE_EVENT_OPTIONS, document: "enrichmentJobs/{jobId}",
}, async (event) => {
  const after = event.data?.after;
  const data = after?.data() as Data;
  const before = event.data?.before.data() as Data;
  const observedAtMs = after?.updateTime?.toMillis();
  if (!validData(data) || observedAtMs === undefined) return;
  const dueAtMs = enrichmentDue(before, data, observedAtMs);
  if (dueAtMs === undefined) return;
  await queue({ kind: "enrich_job", ownerId: data.ownerId as string, batchId: data.batchId as string,
    resourceId: event.params.jobId, eventId: event.id, observedAtMs, dueAtMs });
});

export const queueSourceExpiry = onDocumentWritten({
  ...DUE_EVENT_OPTIONS, document: "users/{ownerId}/importBatches/{batchId}/sources/{sourceId}",
}, async (event) => {
  const after = event.data?.after;
  const state = after?.data()?.state;
  const observedAtMs = after?.updateTime?.toMillis();
  if (!["registered", "uploading"].includes(String(state)) || observedAtMs === undefined) return;
  await initializeRemoteConfig();
  const dueAtMs = observedAtMs + getImportConfig().sourceTimeoutMinutes * 60_000;
  await queue({ kind: "expire_source", ownerId: event.params.ownerId, batchId: event.params.batchId,
    resourceId: event.params.sourceId, eventId: event.id, observedAtMs, dueAtMs });
});

export const queueBatchRecovery = onDocumentWritten({
  ...DUE_EVENT_OPTIONS, document: "users/{ownerId}/importBatches/{batchId}",
}, async (event) => {
  const after = event.data?.after;
  const observedAtMs = after?.updateTime?.toMillis();
  if (!after || observedAtMs === undefined) return;
  if (pendingDispatch(after.data()?.pendingDispatch)) {
    const current = await after.ref.get();
    const pending = pendingDispatch(current.data()?.pendingDispatch);
    if (pending) await deliverPendingDispatch(getFirestore(), after.ref, pending, enqueueImportTask);
    return;
  }
  if (after.data()?.outcome !== "active") return;
  const dueAtMs = observedAtMs + 15 * 60_000;
  await queue({ kind: "recover_batch", ownerId: event.params.ownerId, batchId: event.params.batchId,
    resourceId: event.params.batchId, eventId: event.id, observedAtMs, dueAtMs });
});
