import { createHash } from "crypto";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { canonicalizeImportTaskPayload, type ImportTaskPayload } from "./enqueue";
import { claimTaskLease, type TaskLeaseClaim } from "./lease";
import { importBatchRef } from "../store/paths";

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

function parseBody(body: unknown): unknown {
  if (typeof body !== "string" && !Buffer.isBuffer(body)) return body;
  try { return JSON.parse(Buffer.from(body).toString("utf8")); } catch { return undefined; }
}

function parseImportTaskPayload(body: unknown): ImportTaskPayload | undefined {
  try { return canonicalizeImportTaskPayload(parseBody(body)); } catch { return undefined; }
}

function leaseReference(payload: ImportTaskPayload, cloudTaskName: string): DocumentReference {
  const taskId = createHash("sha256").update(cloudTaskName).digest("hex");
  return importBatchRef(getFirestore(), payload.ownerId, payload.batchId).collection("tasks").doc(taskId);
}

async function claimPayloadLease(payload: ImportTaskPayload, cloudTaskName: string): Promise<TaskLeaseClaim> {
  return claimTaskLease(leaseReference(payload, cloudTaskName));
}

async function runRegisteredStage(
  payload: ImportTaskPayload,
  lease: Extract<TaskLeaseClaim, { kind: "claimed" }>,
  stages: ImportStageRegistry,
): Promise<TaskHttpResult> {
  const handler = stages[payload.kind];
  if (!handler) return { status: 503, code: "stage_not_registered", retryable: true };
  return handler(payload, lease);
}

export async function dispatchImportTask(
  request: TaskHttpRequest,
  dependencies: DispatchDependencies = {},
): Promise<TaskHttpResult> {
  if (!request.cloudTaskName?.trim()) return { status: 400 };
  const payload = parseImportTaskPayload(request.body);
  if (!payload) return { status: 400 };
  const claimLease = dependencies.claimLease ?? claimPayloadLease;
  const lease = await claimLease(payload, request.cloudTaskName);
  if (lease.kind !== "claimed") return { status: 204 };
  return runRegisteredStage(payload, lease, dependencies.stages ?? importTaskStages);
}
