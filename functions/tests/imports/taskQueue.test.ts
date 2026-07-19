import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalizeImportTaskPayload, enqueueImportTask, importTaskName, type ImportTaskPayload } from "../../src/imports/tasks/enqueue";
import { dispatchImportTask } from "../../src/imports/tasks/dispatch";
import { claimTaskLease } from "../../src/imports/tasks/lease";

const payload: ImportTaskPayload = {
  kind: "discover_item", ownerId: "owner-1", batchId: "batch-1", resourceId: "item-1", planVersion: 1,
};

afterEach(() => vi.unstubAllEnvs());

function fakeLeaseRef(data?: Record<string, unknown>) {
  const tx = {
    get: vi.fn().mockResolvedValue({ exists: data !== undefined, data: () => data }),
    set: vi.fn(),
  };
  const ref = { firestore: { runTransaction: (cb: (tx: typeof tx) => unknown) => cb(tx) } };
  return { ref, tx };
}

function stubTaskEnv(url = "https://import-worker-abc123-asia-southeast1.a.run.app/import") {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("IMPORT_TASKS_LOCATION", "asia-southeast1");
  vi.stubEnv("IMPORT_TASKS_QUEUE", "durable-imports");
  vi.stubEnv("IMPORT_WORKER_URL", url);
  vi.stubEnv("IMPORT_WORKER_ALLOWED_HOSTS", new URL(url).hostname);
  vi.stubEnv("IMPORT_TASKS_SERVICE_ACCOUNT", "import-task-service-account@test-project.iam.gserviceaccount.com");
}

describe("durable import task queue", () => {
  it("uses structured identity without delimiter collisions", () => {
    expect(importTaskName(payload)).toBe(importTaskName(payload));
    expect(importTaskName({ ...payload, planVersion: 2 })).not.toBe(importTaskName(payload));
    expect(importTaskName({ ...payload, ownerId: "a\u001fb", batchId: "c" }))
      .not.toBe(importTaskName({ ...payload, ownerId: "a", batchId: "b\u001fc" }));
  });

  it("rejects invalid payloads and unknown fields", () => {
    const invalid = [
      { ...payload, extra: true }, { ...payload, kind: "unknown" }, { ...payload, ownerId: "   " },
      { ...payload, batchId: 3 }, { ...payload, resourceId: null }, { ...payload, planVersion: 0 },
      { ...payload, planVersion: "1" }, { ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.resourceId },
    ];
    for (const value of invalid) expect(() => canonicalizeImportTaskPayload(value)).toThrow();
  });

  it.each(["kind", "ownerId", "batchId", "resourceId"])("rejects inherited %s", (field) => {
    const own = { ...payload } as Record<string, unknown>;
    delete own[field];
    const inherited = Object.create({ [field]: payload[field as keyof ImportTaskPayload] });
    Object.assign(inherited, own);
    expect(() => canonicalizeImportTaskPayload(inherited)).toThrow();
  });

  it("uses the canonical payload for both identity and HTTP body", async () => {
    stubTaskEnv();
    const input = { ...payload, ownerId: " owner-1 ", resourceId: " item-1 " };
    const createTask = vi.fn().mockResolvedValue({});
    await enqueueImportTask(input, { client: { createTask } });
    const request = createTask.mock.calls[0]?.[0].task.httpRequest;
    expect(JSON.parse(Buffer.from(request.body, "base64").toString("utf8"))).toEqual(payload);
    expect(createTask.mock.calls[0]?.[0].task.name).toContain(importTaskName(input));
  });

  it.each([{ code: 6 }, { code: "6" }, { code: "ALREADY_EXISTS" }])
    ("maps duplicate error $code to exists", async (error) => {
      stubTaskEnv();
      await expect(enqueueImportTask(payload, {
        client: { createTask: vi.fn().mockRejectedValue(error) },
      })).resolves.toBe("exists");
    });

  it("returns created and rethrows nonduplicate errors", async () => {
    stubTaskEnv();
    await expect(enqueueImportTask(payload, { client: { createTask: vi.fn().mockResolvedValue({}) } }))
      .resolves.toBe("created");
    const error = { code: "PERMISSION_DENIED" };
    await expect(enqueueImportTask(payload, { client: { createTask: vi.fn().mockRejectedValue(error) } }))
      .rejects.toBe(error);
  });

  it("rejects missing Cloud Tasks metadata and dispatches an allowlisted kind", async () => {
    const claimLease = vi.fn().mockResolvedValue({ kind: "claimed", attempt: 1 });
    await expect(dispatchImportTask({ body: JSON.stringify(payload) }, { claimLease, stages: {} }))
      .resolves.toMatchObject({ status: 400 });
    await expect(dispatchImportTask({ body: JSON.stringify(payload), cloudTaskName: "task-1" }, {
      claimLease, stages: { discover_item: async () => ({ status: 204 }) },
    })).resolves.toMatchObject({ status: 204 });
    expect(claimLease).toHaveBeenCalledOnce();
  });

  it("releases a claimed lease when a stage throws so Cloud Tasks can retry", async () => {
    const claimLease = vi.fn().mockResolvedValue({ kind: "claimed", attempt: 2 }); const releaseLease = vi.fn();
    await expect(dispatchImportTask({ body: JSON.stringify(payload), cloudTaskName: "task-1" }, {
      claimLease, releaseLease, stages: { discover_item: async () => { throw new Error("temporary"); } },
    })).resolves.toEqual({ status: 503, retryable: true });
    expect(releaseLease).toHaveBeenCalledWith(payload, "task-1", 2);
  });

});
