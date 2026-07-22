import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { firestore, seedApplyFamily, sourceBytes } from "./workerIntegrationHarness";

vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const actual = await importOriginal(); const harness = await import("./workerIntegrationHarness");
  return { ...actual, getFirestore: () => harness.firestore };
});
vi.mock("@google-cloud/tasks", () => ({ CloudTasksClient: class { createTask = vi.fn().mockResolvedValue({}); } }));
vi.mock("firebase-admin/storage", async (importOriginal) => {
  const actual = await importOriginal(); const harness = await import("./workerIntegrationHarness");
  return { ...actual, getStorage: () => ({ bucket: () => harness.bucket }) };
});
vi.mock("../../src/bootstrap/adminApp", async () => {
  const harness = await import("./workerIntegrationHarness");
  return { db: harness.firestore, storage: { bucket: () => harness.bucket } };
});
vi.mock("../../src/config/remoteConfig", () => ({
  getConfigValue: (_key: string, fallback: string) => fallback,
  getConfigNumber: (_key: string, fallback: number) => fallback,
}));
vi.mock("../../src/ingest/batchEnrich", () => ({ submitPendingEnrichmentBatch: vi.fn(async () => undefined) }));

import { dispatchImportTask, type ImportStageRegistry, importTaskLeaseId, productionImportStages } from "../../src/imports/tasks/dispatch";
import { buildHttpTask } from "../../src/imports/tasks/enqueue";
import { importTaskWorker } from "../../src/triggers/imports";
import { IMPORT_TASK_WORKER_OPTIONS } from "../../src/options";

const payload = { kind: "discover_item" as const, ownerId: "owner-1", batchId: "batch-1", resourceId: "item-1" };
const request = { body: JSON.stringify(payload), cloudTaskName: "projects/test/tasks/task-1" };
const applyPayload = { kind: "apply_family" as const, ownerId: "owner-1", batchId: "batch-1", resourceId: "atlas", planVersion: 2 };
const sha = createHash("sha256").update(sourceBytes).digest("hex");

afterEach(() => vi.unstubAllEnvs());

const response = () => {
  const statuses: number[] = [];
  return { statuses, res: { status: (code: number) => ({ send: () => statuses.push(code) }) } };
};

describe("authenticated durable import dispatcher", () => {
  it("never claims malformed or unknown payloads", async () => {
    const claimLease = vi.fn();
    for (const body of ["not-json", JSON.stringify({ ...payload, kind: "unknown" })]) {
      await expect(dispatchImportTask({ ...request, body }, { claimLease, stages: {} })).resolves.toEqual({ status: 400 });
    }
    expect(claimLease).not.toHaveBeenCalled();
  });

  it("does not lease an unregistered stage and can execute after registration", async () => {
    const claimLease = vi.fn().mockResolvedValue({ kind: "claimed", attempt: 1 });
    const completeLease = vi.fn();
    const stages: ImportStageRegistry = {};
    await expect(dispatchImportTask(request, { claimLease, stages }))
      .resolves.toEqual({ status: 503, code: "stage_not_registered", retryable: true });
    expect(claimLease).not.toHaveBeenCalled();
    stages.discover_item = async () => ({ status: 204 });
    await expect(dispatchImportTask(request, { claimLease, completeLease, stages })).resolves.toEqual({ status: 204 });
    expect(claimLease).toHaveBeenCalledOnce();
    expect(completeLease).toHaveBeenCalledWith(payload, request.cloudTaskName, 1);
  });

  it("releases only retryable dispatch failures", async () => {
    const claimLease = vi.fn().mockResolvedValue({ kind: "claimed", attempt: 1 });
    const releaseLease = vi.fn();
    const completeLease = vi.fn();
    const stages: ImportStageRegistry = { discover_item: async () => ({ status: 503, retryable: true }) };
    await expect(dispatchImportTask(request, { claimLease, releaseLease, completeLease, stages })).resolves.toEqual({ status: 503, retryable: true });
    expect(releaseLease).toHaveBeenCalledWith(payload, request.cloudTaskName, 1);
    expect(completeLease).not.toHaveBeenCalled();
  });

  it("derives a stable lease identity from the Cloud Task name", () => {
    expect(importTaskLeaseId(request.cloudTaskName)).toBe(importTaskLeaseId(request.cloudTaskName));
    expect(importTaskLeaseId(request.cloudTaskName)).not.toBe(importTaskLeaseId("task-2"));
  });

  it("executes and redelivers a canonical apply_family task through the worker", async () => {
    expect(productionImportStages.apply_family).toBeTypeOf("function");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
    vi.stubEnv("FUNCTIONS_REGION", "asia-southeast1");
    vi.stubEnv("IMPORT_TASKS_QUEUE", "seriph-import");
    vi.stubEnv("IMPORT_WORKER_URL", "https://asia-southeast1-test-project.cloudfunctions.net/importTaskWorker");
    vi.stubEnv("IMPORT_WORKER_ALLOWED_HOSTS", "asia-southeast1-test-project.cloudfunctions.net");
    vi.stubEnv("IMPORT_WORKER_SERVICE_ACCOUNT", "import-worker@test-project.iam.gserviceaccount.com");
    seedApplyFamily(sha);
    const task = buildHttpTask(applyPayload);
    const headers = { authorization: "Bearer integration-test-token", "x-cloudtasks-taskname": task.name };
    const taskRequest = { body: Buffer.from(task.httpRequest!.body!, "base64"), headers, get: (name: string) => headers[name.toLowerCase()] };
    const first = response();
    await importTaskWorker(taskRequest as any, first.res as any);
    const second = response();
    await importTaskWorker(taskRequest as any, second.res as any);
    expect(task.httpRequest?.oidcToken).toMatchObject({ serviceAccountEmail: "import-worker@test-project.iam.gserviceaccount.com", audience: task.httpRequest?.url });
    expect(first.statuses).toEqual([204]);
    expect(second.statuses).toEqual([204]);
    expect([...first.statuses, ...second.statuses]).not.toContain(503);
    expect(firestore.docs.get("fontfamilies/owner-1__atlas")).toMatchObject({ version: 1, status: "ready", styleCount: 1 });
    expect(firestore.docs.get(`users/owner-1/assetClaims/${sha}`)).toMatchObject({ status: "committed" });
    expect(firestore.docs.get(`users/owner-1/importBatches/batch-1/tasks/${importTaskLeaseId(task.name)}`)).toMatchObject({ state: "complete", attempt: 1 });
    expect(firestore.writes.filter((path) => path === "fontfamilies/owner-1__atlas")).toHaveLength(1);
  });

  it("refuses a canceled batch through the deployed discovery stage", async () => {
    const batchPath = "users/owner-1/importBatches/batch-1"; const itemPath = `${batchPath}/items/item-1`;
    firestore.docs.set(batchPath, { outcome: "canceled" }); firestore.docs.set(itemPath, { state: "discovered", ownerId: "owner-1", batchId: "batch-1", itemId: "item-1" });
    await expect(dispatchImportTask(request, { stages: productionImportStages })).resolves.toEqual({ status: 204 });
    expect(firestore.docs.get(itemPath)).toMatchObject({ state: "discovered" });
    expect(firestore.docs.get(`users/owner-1/importBatches/batch-1/tasks/${importTaskLeaseId(request.cloudTaskName)}`)).toMatchObject({ state: "complete", attempt: 1 });
  });

  it("publishes the private worker with the required contract", async () => {
    vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: "test-project", storageBucket: "test-project.appspot.com" }));
    const entrypoint = await import("../../src/index");
    expect(IMPORT_TASK_WORKER_OPTIONS).toMatchObject({
      region: "asia-southeast1", memory: "1GiB", cpu: 2, timeoutSeconds: 540, maxInstances: 4,
      invoker: "import-task-service-account@seriph.iam.gserviceaccount.com",
    });
    expect(importTaskWorker).toBe(entrypoint.importTaskWorker);
  });
});
