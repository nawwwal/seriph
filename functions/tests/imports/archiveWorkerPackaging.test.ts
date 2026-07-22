import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("archive worker packaging", () => {
  it("uses Node 22, a non-root user, and only the worker server", () => {
    const dockerfile = readFileSync(resolve(__dirname, "../../Dockerfile.archive-worker"), "utf8");
    expect(dockerfile).toContain("FROM node:22"); expect(dockerfile).toContain("USER node"); expect(dockerfile).toContain("lib/imports/archiveWorker/server.js");
  });
  it("prints private idempotent setup in dry-run mode", () => {
    const script = resolve(__dirname, "../../../infra/import-pipeline/setup.sh"); const output = execFileSync("bash", [script, "--project", "seriph", "--dry-run"], { encoding: "utf8" });
    for (const value of ["cloudtasks.googleapis.com", "seriph-import", "seriph-archive-worker", "archive-worker-service-account", "--service-account archive-worker-service-account@seriph.iam.gserviceaccount.com", "GOOGLE_CLOUD_PROJECT=seriph", "IMPORT_TASKS_LOCATION=asia-southeast1", "IMPORT_TASKS_QUEUE=seriph-import", "IMPORT_WORKER_URL=https://asia-southeast1-seriph.cloudfunctions.net/importTaskWorker", "IMPORT_WORKER_SERVICE_ACCOUNT=import-task-service-account@seriph.iam.gserviceaccount.com", "IMPORT_TASKS_SERVICE_ACCOUNT=import-task-service-account@seriph.iam.gserviceaccount.com", "IMPORT_ARCHIVE_WORKER_URL", "IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS", "--no-allow-unauthenticated", "--memory=1Gi", "--cpu=2", "--concurrency=1", "--timeout=900"]) expect(output).toContain(value);
    const env = readFileSync(resolve(__dirname, "../../.env.example"), "utf8");
    expect(env).toContain("IMPORT_ARCHIVE_WORKER_URL="); expect(env).toContain("IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS=");
  });
  it("derives the Functions task environment from the project argument", () => {
    const script = resolve(__dirname, "../../../infra/import-pipeline/setup.sh"); const output = execFileSync("bash", [script, "--project", "other-project", "--dry-run"], { encoding: "utf8" });
    expect(output).toContain("GOOGLE_CLOUD_PROJECT=other-project");
    expect(output).toContain("IMPORT_WORKER_URL=https://asia-southeast1-other-project.cloudfunctions.net/importTaskWorker");
    expect(output).toContain("IMPORT_TASKS_SERVICE_ACCOUNT=import-task-service-account@other-project.iam.gserviceaccount.com");
  });
  it("scopes runtime Storage and task roles to the configured bucket and queue", () => {
    const script = resolve(__dirname, "../../../infra/import-pipeline/setup.sh"); const output = execFileSync("bash", [script, "--project", "seriph", "--bucket", "seriph-imports", "--dry-run"], { encoding: "utf8" });
    const worker = "serviceAccount:archive-worker-service-account@seriph.iam.gserviceaccount.com";
    const storageRole = "projects/seriph/roles/archiveWorkerStorage";
    expect(output).toContain(`gcloud projects add-iam-policy-binding seriph --member ${worker} --role roles/datastore.user`);
    expect(output).toContain("gcloud iam roles create archiveWorkerStorage --project seriph");
    expect(output).toContain("--permissions storage.objects.get\\,storage.objects.list\\,storage.objects.create\\,storage.objects.update --stage GA");
    expect(output).toContain(`gcloud storage buckets add-iam-policy-binding gs://seriph-imports --member ${worker} --role ${storageRole} --project seriph`);
    expect(output).toContain(`gcloud tasks queues add-iam-policy-binding seriph-import --location asia-southeast1 --member ${worker} --role roles/cloudtasks.enqueuer --project seriph`);
    expect(output).toContain("FIREBASE_STORAGE_BUCKET=seriph-imports");
    expect(output).not.toContain("storage.objects.delete"); expect(output).not.toContain("roles/storage.objectUser"); expect(output).not.toContain("roles/storage.objectAdmin"); expect(output).not.toContain("roles/storage.admin"); expect(output).not.toContain("roles/editor"); expect(output).not.toContain("roles/owner");
    expect(output).not.toContain("projects add-iam-policy-binding seriph --member serviceAccount:archive-worker-service-account@seriph.iam.gserviceaccount.com --role roles/cloudtasks.enqueuer");
  });
});
