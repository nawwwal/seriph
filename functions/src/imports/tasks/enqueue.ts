import { createHash } from "crypto";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { protos } from "@google-cloud/tasks";

export interface ImportTaskPayload {
  kind: "discover_source" | "discover_item" | "finalize_plan" | "apply_family" | "reconcile_batch";
  ownerId: string;
  batchId: string;
  resourceId: string;
  planVersion?: number;
}

type Task = protos.google.cloud.tasks.v2.ITask;
type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;
type TaskClient = Pick<CloudTasksClient, "createTask">;

export interface EnqueueDependencies {
  client?: TaskClient;
}

function requiredEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
}

function projectId(): string {
  return requiredEnv("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT");
}

export function queuePath(): string {
  const location = requiredEnv(
    "IMPORT_TASKS_LOCATION",
    "CLOUD_TASKS_LOCATION",
    "GOOGLE_CLOUD_LOCATION",
    "FUNCTIONS_REGION",
  );
  const queue = requiredEnv("IMPORT_TASKS_QUEUE", "IMPORT_TASK_QUEUE", "CLOUD_TASKS_QUEUE");
  return `projects/${projectId()}/locations/${location}/queues/${queue}`;
}

function taskNameSuffix(payload: ImportTaskPayload): string {
  const identity = [
    payload.kind,
    payload.ownerId,
    payload.batchId,
    payload.resourceId,
    payload.planVersion === undefined ? "" : String(payload.planVersion),
  ].join("\u001f");
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `import-${payload.kind}-${digest}`;
}

export function importTaskName(payload: ImportTaskPayload): string {
  return taskNameSuffix(payload);
}

function taskResourceName(payload: ImportTaskPayload): string {
  return `${queuePath()}/tasks/${importTaskName(payload)}`;
}

function workerUrl(): string {
  const value = requiredEnv("IMPORT_WORKER_URL", "IMPORT_PRIVATE_WORKER_URL", "CLOUD_TASKS_WORKER_URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("IMPORT_WORKER_URL must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:") throw new Error("IMPORT_WORKER_URL must be an absolute HTTPS URL");
  return value;
}

function workerServiceAccount(): string {
  const email = process.env.IMPORT_WORKER_SERVICE_ACCOUNT?.trim()
    || process.env.IMPORT_TASKS_SERVICE_ACCOUNT?.trim()
    || process.env.CLOUD_TASKS_SERVICE_ACCOUNT?.trim()
    || `${projectId()}@appspot.gserviceaccount.com`;
  const project = projectId();
  if (email !== `${project}@appspot.gserviceaccount.com`
    && !email.endsWith(`@${project}.iam.gserviceaccount.com`)) {
    throw new Error("Cloud Tasks service account must belong to the configured project");
  }
  return email;
}

export function buildHttpTask(payload: ImportTaskPayload, name = taskResourceName(payload)): Task {
  const url = workerUrl();
  return {
    name,
    httpRequest: {
      httpMethod: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
      oidcToken: {
        serviceAccountEmail: workerServiceAccount(),
        audience: url,
      },
    },
  };
}

let defaultClient: CloudTasksClient | undefined;

export function cloudTasksClient(): CloudTasksClient {
  defaultClient ??= new CloudTasksClient();
  return defaultClient;
}

function grpcCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: number | string; status?: number | string };
  return value.code ?? value.status;
}

export async function enqueueImportTask(
  payload: ImportTaskPayload,
  dependencies: EnqueueDependencies = {},
): Promise<"created" | "exists"> {
  const task = buildHttpTask(payload);
  const client = dependencies.client ?? cloudTasksClient();
  const request: CreateTaskRequest = { parent: queuePath(), task };
  try {
    await client.createTask(request);
    return "created";
  } catch (error) {
    if (grpcCode(error) === 6 || grpcCode(error) === "ALREADY_EXISTS") return "exists";
    throw error;
  }
}
