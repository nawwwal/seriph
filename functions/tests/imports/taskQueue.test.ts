import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueImportTask,
  importTaskName,
  type ImportTaskPayload,
} from "../../src/imports/tasks/enqueue";
import { claimTaskLease } from "../../src/imports/tasks/lease";

const payload: ImportTaskPayload = {
  kind: "discover_item",
  ownerId: "owner-1",
  batchId: "batch-1",
  resourceId: "item-1",
  planVersion: 1,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function fakeLeaseRef(data: Record<string, unknown>) {
  const tx = {
    get: vi.fn().mockResolvedValue({ exists: true, data: () => data }),
    set: vi.fn(),
  };
  return {
    tx,
    ref: {
      firestore: {
        runTransaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
      },
    }
  }
}

describe("durable import task queue", () => {
  it("uses the same Cloud Task name for the same stage resource", () => {
    expect(importTaskName(payload)).toBe(importTaskName(payload));
    expect(importTaskName({ ...payload, planVersion: 2 })).not.toBe(importTaskName(payload));
  });

  it("builds a private OIDC task and maps an existing task to exists", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
    vi.stubEnv("IMPORT_TASKS_LOCATION", "us-central1");
    vi.stubEnv("IMPORT_TASKS_QUEUE", "durable-imports");
    vi.stubEnv("IMPORT_WORKER_URL", "https://private-worker.example.com/import");
    vi.stubEnv("IMPORT_WORKER_SERVICE_ACCOUNT", "import-worker@test-project.iam.gserviceaccount.com");

    const createTask = vi.fn().mockRejectedValueOnce({ code: 6 });
    const result = await enqueueImportTask(payload, { client: { createTask } });

    expect(result).toBe("exists");
    expect(createTask).toHaveBeenCalledWith({
      parent: "projects/test-project/locations/us-central1/queues/durable-imports",
      task: expect.objectContaining({
        name: `projects/test-project/locations/us-central1/queues/durable-imports/tasks/${importTaskName(payload)}`,
        httpRequest: expect.objectContaining({
          url: "https://private-worker.example.com/import",
          oidcToken: {
            serviceAccountEmail: "import-worker@test-project.iam.gserviceaccount.com",
            audience: "https://private-worker.example.com/import",
          },
        }),
      }),
    });

    const request = createTask.mock.calls[0]?.[0].task.httpRequest;
    expect(JSON.parse(Buffer.from(request.body, "base64").toString("utf8"))).toEqual(payload);
  });

  it("returns created when Cloud Tasks accepts a new task", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
    vi.stubEnv("IMPORT_TASKS_LOCATION", "us-central1");
    vi.stubEnv("IMPORT_TASKS_QUEUE", "durable-imports");
    vi.stubEnv("IMPORT_WORKER_URL", "https://private-worker.example.com/import");

    const createTask = vi.fn().mockResolvedValue({});
    await expect(enqueueImportTask(payload, { client: { createTask } })).resolves.toBe("created");
  });

  it("reclaims only expired retryable leases", async () => {
    const now = new Date("2026-07-18T10:00:00.000Z");
    const expiredRetryable = fakeLeaseRef({
      state: "retryable",
      attempt: 1,
      leaseExpiresAt: new Date("2026-07-18T09:59:00.000Z"),
    });
    const activeLease = fakeLeaseRef({
      state: "leased",
      attempt: 1,
      leaseExpiresAt: new Date("2026-07-18T10:01:00.000Z"),
    });

    expect(await claimTaskLease(expiredRetryable.ref as never, now)).toMatchObject({
      kind: "claimed",
      attempt: 2,
    });
    expect(await claimTaskLease(activeLease.ref as never, now)).toEqual({ kind: "busy" });
    expect(expiredRetryable.tx.set).toHaveBeenCalledOnce();
    expect(activeLease.tx.set).not.toHaveBeenCalled();
  });
});
