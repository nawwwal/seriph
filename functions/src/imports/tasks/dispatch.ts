import { createHash } from "crypto";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { canonicalizeImportTaskPayload, type ImportTaskPayload } from "./enqueue";
import { enqueueImportTask } from "./enqueue";
import { claimTaskLease, type TaskLeaseClaim } from "./lease";
import { importBatchRef } from "../store/paths";
import { getImportConfig } from "../config/importConfig";
import { discoverItemTask, discoverSourceTask, type DiscoveryRuntime } from "../discovery/archiveStages";
import { applyFamilyImportStage } from "../apply/applyFamilyStage";
import { reconcileBatchTask } from "../reconcile/reconcileBatch";

export interface TaskHttpRequest {
  body: unknown;
  cloudTaskName?: string;
}

export interface TaskHttpResult {
  status: 204 | 400 | 503;
  code?: "stage_not_registered";
  retryable?: boolean;
}

export type ImportStageHandler = (
  payload: ImportTaskPayload,
  lease: Extract<TaskLeaseClaim, { kind: "claimed" }>,
) => Promise<TaskHttpResult>;
export type ImportStageRegistry = Partial<Record<ImportTaskPayload["kind"], ImportStageHandler>>;

export interface DispatchDependencies {
  claimLease?: (payload: ImportTaskPayload, cloudTaskName: string) => Promise<TaskLeaseClaim>;
  stages?: ImportStageRegistry;
}

export const importTaskStages: ImportStageRegistry = {};

/** Register a durable stage once; archive children use the existing discover_item lane. */
export function registerImportStage(kind: ImportTaskPayload["kind"], handler: ImportStageHandler): void {
  importTaskStages[kind] = handler;
}

const productionRuntime = (): DiscoveryRuntime => {
  const config = getImportConfig(); const bucket = getStorage().bucket();
  return {
    db: getFirestore(), limits: { maxDepth: config.archiveMaxDepth, maxEntries: config.archiveMaxEntries,
      maxExpandedBatchBytes: config.archiveMaxExpandedBatchBytes, maxEntryBytes: config.archiveMaxEntryBytes,
      maxCompressionRatio: config.archiveMaxCompressionRatio, maxPathBytes: config.archiveMaxPathBytes },
    download: async (path) => (await bucket.file(path).download())[0],
    stage: async (child) => bucket.file(child.staging.path).save(child.staging.bytes, { resumable: false, metadata: { contentType: child.inventory.mimeType } }),
    enqueue: enqueueImportTask,
  };
};

export function registerDefaultImportStages(runtime: () => DiscoveryRuntime = productionRuntime): ImportStageRegistry {
  const stages: ImportStageRegistry = {
    discover_source: (payload) => discoverSourceTask(payload, runtime()),
    discover_item: (payload) => discoverItemTask(payload, runtime()),
    apply_family: applyFamilyImportStage,
    reconcile_batch: (payload) => reconcileBatchTask(payload, getFirestore()),
  };
  Object.assign(importTaskStages, stages);
  return stages;
}

export const productionImportStages = registerDefaultImportStages();

export function importTaskLeaseId(cloudTaskName: string): string {
  return createHash("sha256").update(cloudTaskName).digest("hex");
}

function parseBody(body: unknown): unknown {
  if (typeof body !== "string" && !Buffer.isBuffer(body)) return body;
  try { return JSON.parse(Buffer.from(body).toString("utf8")); } catch { return undefined; }
}

function parseImportTaskPayload(body: unknown): ImportTaskPayload | undefined {
  try { return canonicalizeImportTaskPayload(parseBody(body)); } catch { return undefined; }
}

function leaseReference(payload: ImportTaskPayload, cloudTaskName: string): DocumentReference {
  return importBatchRef(getFirestore(), payload.ownerId, payload.batchId).collection("tasks")
    .doc(importTaskLeaseId(cloudTaskName));
}

async function claimPayloadLease(payload: ImportTaskPayload, cloudTaskName: string): Promise<TaskLeaseClaim> {
  return claimTaskLease(leaseReference(payload, cloudTaskName));
}

export async function dispatchImportTask(
  request: TaskHttpRequest,
  dependencies: DispatchDependencies = {},
): Promise<TaskHttpResult> {
  if (!request.cloudTaskName?.trim()) return { status: 400 };
  const payload = parseImportTaskPayload(request.body);
  if (!payload) return { status: 400 };
  const stages = dependencies.stages ?? importTaskStages;
  const handler = Object.prototype.hasOwnProperty.call(stages, payload.kind) ? stages[payload.kind] : undefined;
  if (!handler) return { status: 503, code: "stage_not_registered", retryable: true };
  const claimLease = dependencies.claimLease ?? claimPayloadLease;
  const lease = await claimLease(payload, request.cloudTaskName);
  if (lease.kind !== "claimed") return { status: 204 };
  return handler(payload, lease);
}
