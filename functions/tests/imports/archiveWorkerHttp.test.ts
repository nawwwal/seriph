import { request } from "node:http";
import { describe, expect, it } from "vitest";
import { createArchiveWorkerServer } from "../../src/imports/archiveWorker/server";
import { testDependencies } from "./archiveWorkerSupport";

describe("archive worker HTTP boundary", () => {
  it("returns 413 for a task body over 64 KiB", async () => {
    const server = createArchiveWorkerServer(testDependencies());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const result = await new Promise<{ status: number }>((resolve, reject) => {
      const req = request({ port: typeof address === "object" && address ? address.port : 0, method: "POST" }, (res) => { res.resume(); res.on("end", () => resolve({ status: res.statusCode ?? 0 })); });
      req.on("error", reject); req.end("x".repeat(64 * 1024 + 1));
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(result.status).toBe(413);
  });
});
