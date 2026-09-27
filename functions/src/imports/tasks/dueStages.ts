import { getFirestore, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { initializeRemoteConfig } from "../../config/remoteConfig";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { batchEnrichEnabled } from "../../ingest/batch/client";
import { processRealtimeEnrichmentJob } from "../../enrichment/realtime/processJob";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
import { firestoreSourceTimeoutStore } from "../reconcile/sourceTimeout";
import { deliverPendingDispatch, pendingDispatch } from "../reconcile/pendingDispatch";
import { importBatchRef, importSourceRef } from "../store/paths";
import { enqueueImportTask, type ImportTaskPayload } from "./enqueue";

function due(payload: ImportTaskPayload): boolean {
  return typeof payload.dueAtMs === "number" && Date.now() >= payload.dueAtMs;
}

async function deliverPending(db: Firestore, ref: DocumentReference): Promise<void> {
  const snap = await ref.get();
  const pending = pendingDispatch(snap.data()?.pendingDispatch);
  if (pending) await deliverPendingDispatch(db, ref, pending, enqueueImportTask);
}

export async function runEnrichmentJob(payload: ImportTaskPayload): Promise<{ status: 204 | 503 }> {
  if (!due(payload)) return { status: 503 };
  await initializeRemoteConfig();
  if (!batchEnrichEnabled() || !isVertexEnabled()) return { status: 503 };
  const db = getFirestore();
  const snap = await db.collection("enrichmentJobs").doc(payload.resourceId).get();
  const data = snap.data();
  if (!data || data.ownerId !== payload.ownerId || data.batchId !== payload.batchId) return { status: 204 };
  await processRealtimeEnrichmentJob(db, { ...data, jobId: snap.id } as EnrichmentJob);
  return { status: 204 };
}

export async function expireSourceTask(payload: ImportTaskPayload): Promise<{ status: 204 | 503 }> {
  if (!due(payload)) return { status: 503 };
  const db = getFirestore();
  const batchRef = importBatchRef(db, payload.ownerId, payload.batchId);
  await deliverPending(db, batchRef);
  const ref = importSourceRef(db, payload.ownerId, payload.batchId, payload.resourceId);
  const snap = await ref.get();
  const data = snap.data();
  if (!data || snap.updateTime?.toMillis() !== payload.observedAtMs
    || !["registered", "uploading"].includes(String(data.state))
    || Number(data.committedFamilyCount ?? 0) > 0) return { status: 204 };
  const store = firestoreSourceTimeoutStore({ db, enqueue: enqueueImportTask });
  await store.markTimedOut({ ownerId: payload.ownerId, batchId: payload.batchId,
    sourceId: payload.resourceId, state: String(data.state), updatedAt: payload.observedAtMs!,
    documentPath: ref.path, staleBefore: payload.observedAtMs });
  await deliverPending(db, batchRef);
  return { status: 204 };
}

export async function recoverBatchTask(payload: ImportTaskPayload): Promise<{ status: 204 | 503 }> {
  if (!due(payload)) return { status: 503 };
  const db = getFirestore();
  const ref = importBatchRef(db, payload.ownerId, payload.batchId);
  const snap = await ref.get();
  if (!snap.exists || snap.updateTime?.toMillis() !== payload.observedAtMs
    || snap.data()?.outcome !== "active") return { status: 204 };
  const store = firestoreSourceTimeoutStore({ db, enqueue: enqueueImportTask });
  await store.recoverStaleBatch?.({ ownerId: payload.ownerId, batchId: payload.batchId,
    documentPath: ref.path, pendingDispatch: pendingDispatch(snap.data()?.pendingDispatch) }, payload.observedAtMs!);
  await deliverPending(db, ref);
  return { status: 204 };
}
