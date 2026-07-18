import { createHash } from "crypto";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { protos } from "@google-cloud/tasks";
import { queuePath, workerServiceAccount, workerUrl } from "./workerConfig";

export interface ImportTaskPayload {
  kind: "discover_source" | "discover_item" | "finalize_plan" | "apply_family" | "reconcile_batch";
  ownerId: string;
  batchId: string;
  resourceId: string;
  planVersion?: number;
}
const KINDS = new Set<ImportTaskPayload["kind"]>(["discover_source", "discover_item", "finalize_plan", "apply_family", "reconcile_batch"]);
type Task = protos.google.cloud.tasks.v2.ITask;
type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;
type TaskClient = Pick<CloudTasksClient, "createTask">;
export interface EnqueueDependencies { client?: TaskClient }

function rejectPayload(reason: string): never { throw new Error(`Invalid import task payload: ${reason}`); }
function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) return rejectPayload(`${field} must be a non-empty string`);
  return value.trim();
}
export function canonicalizeImportTaskPayload(input: unknown): ImportTaskPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) return rejectPayload("object required");
  const source = input as Record<PropertyKey, unknown>;
  const allowed = new Set(["kind", "ownerId", "batchId", "resourceId", "planVersion"]);
  if (Reflect.ownKeys(source).some((key) => typeof key !== "string" || !allowed.has(key))) return rejectPayload("unknown field");
  for (const field of ["kind", "ownerId", "batchId", "resourceId"]) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return rejectPayload(`${field} must be an own property`);
  }
  const kind = requiredString(source.kind, "kind");
  if (!KINDS.has(kind as ImportTaskPayload["kind"])) return rejectPayload("unknown kind");
  const payload: ImportTaskPayload = {
    kind: kind as ImportTaskPayload["kind"], ownerId: requiredString(source.ownerId, "ownerId"),
    batchId: requiredString(source.batchId, "batchId"), resourceId: requiredString(source.resourceId, "resourceId"),
  };
  if (Object.prototype.hasOwnProperty.call(source, "planVersion")) {
    if (!Number.isSafeInteger(source.planVersion) || (source.planVersion as number) < 1) return rejectPayload("planVersion must be a positive safe integer");
    payload.planVersion = source.planVersion as number;
  }
  return payload;
}
function serializedPayload(input: unknown): { payload: ImportTaskPayload; serialized: string } {
  const payload = canonicalizeImportTaskPayload(input);
  return { payload, serialized: JSON.stringify(payload) };
}
function taskSuffix(payload: ImportTaskPayload, serialized: string): string {
  return `import-${payload.kind}-${createHash("sha256").update(serialized).digest("hex").slice(0, 32)}`;
}
export function importTaskName(input: unknown): string {
  const { payload, serialized } = serializedPayload(input);
  return taskSuffix(payload, serialized);
}
function taskResourceName(payload: ImportTaskPayload, serialized: string): string {
  return `${queuePath()}/tasks/${taskSuffix(payload, serialized)}`;
}
export function buildHttpTask(input: unknown, name?: string): Task {
  const { payload, serialized } = serializedPayload(input);
  const url = workerUrl();
  const expectedName = taskResourceName(payload, serialized);
  if (name !== undefined && name !== expectedName) throw new Error("Task name does not match canonical payload identity");
  return { name: expectedName, httpRequest: { httpMethod: "POST", url, headers: { "Content-Type": "application/json" },
    body: Buffer.from(serialized, "utf8").toString("base64"), oidcToken: { serviceAccountEmail: workerServiceAccount(), audience: url } } };
}
let defaultClient: CloudTasksClient | undefined;
export function cloudTasksClient(): CloudTasksClient { defaultClient ??= new CloudTasksClient(); return defaultClient; }
function grpcCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: number | string; status?: number | string };
  return value.code ?? value.status;
}
function isAlreadyExists(error: unknown): boolean {
  const code = grpcCode(error);
  return code === 6 || code === "6" || code === "ALREADY_EXISTS";
}
export async function enqueueImportTask(input: unknown, dependencies: EnqueueDependencies = {}): Promise<"created" | "exists"> {
  const task = buildHttpTask(input);
  try { await (dependencies.client ?? cloudTasksClient()).createTask({ parent: queuePath(), task } as CreateTaskRequest); return "created"; }
  catch (error) { if (isAlreadyExists(error)) return "exists"; throw error; }
}
