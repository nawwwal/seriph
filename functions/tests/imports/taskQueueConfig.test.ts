import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueImportTask, type ImportTaskPayload } from "../../src/imports/tasks/enqueue";

const payload: ImportTaskPayload = { kind: "discover_item", ownerId: "owner-1", batchId: "batch-1", resourceId: "item-1", planVersion: 1 };

afterEach(() => vi.unstubAllEnvs());

function stubTaskEnv(url = "https://import-worker-abc123-asia-southeast1.a.run.app/import") {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project"); vi.stubEnv("IMPORT_TASKS_LOCATION", "asia-southeast1");
  vi.stubEnv("IMPORT_TASKS_QUEUE", "durable-imports"); vi.stubEnv("IMPORT_WORKER_URL", url);
  vi.stubEnv("IMPORT_WORKER_ALLOWED_HOSTS", new URL(url).hostname);
  vi.stubEnv("IMPORT_TASKS_SERVICE_ACCOUNT", "import-task-service-account@test-project.iam.gserviceaccount.com");
}

describe("import task endpoint configuration", () => {
  it("uses an allowlisted private worker and exact OIDC audience", async () => {
    stubTaskEnv(); vi.stubEnv("IMPORT_WORKER_SERVICE_ACCOUNT", "import-worker@test-project.iam.gserviceaccount.com");
    const createTask = vi.fn().mockRejectedValue({ code: "6" });
    expect(await enqueueImportTask(payload, { client: { createTask } })).toBe("exists");
    const task = createTask.mock.calls[0]?.[0].task;
    expect(task.httpRequest.oidcToken.audience).toBe(task.httpRequest.url);
  });

  it.each([
    "https://example.com/import", "http://import-worker-abc123-asia-southeast1.a.run.app/import",
    "https://import-worker-abc123-asia-southeast1.a.run.app:443/import",
    "https://import-worker-abc123-asia-southeast1.a.run.app/import?public=true",
  ])("rejects unsafe worker endpoint %s", async (url) => {
    stubTaskEnv(url);
    await expect(enqueueImportTask(payload, { client: { createTask: vi.fn() } })).rejects.toThrow();
  });

  it("requires explicit allowlist and task service account", async () => {
    stubTaskEnv(); delete process.env.IMPORT_WORKER_ALLOWED_HOSTS;
    await expect(enqueueImportTask(payload, { client: { createTask: vi.fn() } })).rejects.toThrow();
    stubTaskEnv(); delete process.env.IMPORT_TASKS_SERVICE_ACCOUNT;
    await expect(enqueueImportTask(payload, { client: { createTask: vi.fn() } })).rejects.toThrow(/Missing required environment variable/);
  });
});
