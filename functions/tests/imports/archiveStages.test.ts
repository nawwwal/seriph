import { expect, it } from "vitest";
import { discoverSourceTask } from "../../src/imports/discovery/archiveStages";

it("records a missing inline source object instead of returning an unhandled retry", async () => {
  const source = { ownerId: "u1", batchId: "b1", sourceId: "s1", originalPath: "font.otf", filename: "font.otf", declaredSize: 12, declaredMimeType: "font/otf", storagePath: "intake/u1/b1/s1/font.otf", state: "uploaded" };
  const path = "users/u1/importBatches/b1/sources/s1"; const docs = new Map([[path, source]]);
  const ref = (value: string): any => ({ get: async () => ({ exists: docs.has(value), data: () => docs.get(value) }), collection: (name: string) => ({ doc: (id: string) => ref(`${value}/${name}/${id}`) }) });
  const db: any = { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }), runTransaction: async (run: (tx: any) => unknown) => run({
    get: (document: any) => document.get(), update: (document: any, update: Record<string, unknown>) => docs.set(path, { ...docs.get(path), ...update }),
  }) };
  const error = Object.assign(new Error("not found"), { code: 404 });
  const runtime = { db, limits: {} as never, download: async () => { throw error; }, stage: async () => undefined, enqueue: async () => undefined };
  await expect(discoverSourceTask({ kind: "discover_source", ownerId: "u1", batchId: "b1", resourceId: "s1" }, runtime)).resolves.toEqual({ status: 204 });
  expect(docs.get(path)).toMatchObject({ state: "failed" });
});
