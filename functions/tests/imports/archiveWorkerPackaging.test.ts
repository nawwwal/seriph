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
    for (const value of ["cloudtasks.googleapis.com", "seriph-import", "seriph-archive-worker", "archive-worker-service-account", "--service-account archive-worker-service-account@seriph.iam.gserviceaccount.com", "--no-allow-unauthenticated", "--memory=1Gi", "--cpu=2", "--concurrency=1", "--timeout=900"]) expect(output).toContain(value);
  });
});
