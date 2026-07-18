import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHttpTask, type ImportTaskPayload } from "../../src/imports/tasks/enqueue";

const sourceTask: ImportTaskPayload & { sourceSize: number } = {
  kind: "discover_source", ownerId: "owner-1", batchId: "batch-1", resourceId: "source-1", sourceSize: 150 * 1024 * 1024 + 1,
};

function env() {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("IMPORT_TASKS_LOCATION", "asia-southeast1");
  vi.stubEnv("IMPORT_TASKS_QUEUE", "seriph-import");
  vi.stubEnv("IMPORT_WORKER_URL", "https://import-worker-abc123-asia-southeast1.a.run.app/import");
  vi.stubEnv("IMPORT_WORKER_ALLOWED_HOSTS", "import-worker-abc123-asia-southeast1.a.run.app");
  vi.stubEnv("IMPORT_TASKS_SERVICE_ACCOUNT", "import-task-service-account@test-project.iam.gserviceaccount.com");
  vi.stubEnv("IMPORT_ARCHIVE_WORKER_URL", "https://seriph-archive-worker-abc123-asia-southeast1.a.run.app/import");
  vi.stubEnv("IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS", "seriph-archive-worker-abc123-asia-southeast1.a.run.app");
}

afterEach(() => vi.unstubAllEnvs());

describe("oversized archive task routing", () => {
  it("routes oversized discover_source tasks to the private archive worker", () => {
    env();
    const task = buildHttpTask(sourceTask).httpRequest!;
    expect(task.url).toBe(process.env.IMPORT_ARCHIVE_WORKER_URL);
    expect(task.oidcToken?.audience).toBe(process.env.IMPORT_ARCHIVE_WORKER_URL);
  });

  it("keeps normal discover_source tasks on the regular worker", () => {
    env();
    const task = buildHttpTask({ ...sourceTask, sourceSize: 150 * 1024 * 1024 }).httpRequest!;
    expect(task.url).toBe(process.env.IMPORT_WORKER_URL);
  });
});
