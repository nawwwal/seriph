import { describe, expect, it, vi } from "vitest";
import { dispatchImportTask, type ImportStageRegistry, importTaskLeaseId } from "../../src/imports/tasks/dispatch";
import { importTaskWorker } from "../../src/triggers/imports";
import { IMPORT_TASK_WORKER_OPTIONS } from "../../src/options";

const payload = { kind: "discover_item" as const, ownerId: "owner-1", batchId: "batch-1", resourceId: "item-1" };
const request = { body: JSON.stringify(payload), cloudTaskName: "projects/test/tasks/task-1" };

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
    const stages: ImportStageRegistry = {};
    await expect(dispatchImportTask(request, { claimLease, stages }))
      .resolves.toEqual({ status: 503, code: "stage_not_registered", retryable: true });
    expect(claimLease).not.toHaveBeenCalled();
    stages.discover_item = async () => ({ status: 204 });
    await expect(dispatchImportTask(request, { claimLease, stages })).resolves.toEqual({ status: 204 });
    expect(claimLease).toHaveBeenCalledOnce();
  });

  it("derives a stable lease identity from the Cloud Task name", () => {
    expect(importTaskLeaseId(request.cloudTaskName)).toBe(importTaskLeaseId(request.cloudTaskName));
    expect(importTaskLeaseId(request.cloudTaskName)).not.toBe(importTaskLeaseId("task-2"));
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
