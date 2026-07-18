import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "seriph-task-5-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("durable import batch rules", () => {
  it("allows an owner to read a batch tree and denies cross-owner reads and all client writes", async () => {
    const ownerDb = testEnv.authenticatedContext("u1").firestore();
    const otherDb = testEnv.authenticatedContext("u2").firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/sources/s1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/items/i1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/items/i1/details/d1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/families/f1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/tasks/t1")));
    await assertSucceeds(getDoc(doc(ownerDb, "users/u1/importBatches/b1/mutations/m1")));
    await assertFails(getDoc(doc(otherDb, "users/u1/importBatches/b1")));
    await assertFails(getDoc(doc(otherDb, "users/u1/importBatches/b1/items/i1")));
    await assertFails(setDoc(doc(ownerDb, "users/u1/importBatches/b1"), { outcome: "succeeded" }));
    await assertFails(setDoc(doc(ownerDb, "users/u1/importBatches/b1/items/i1"), { state: "applied" }));
  });
});
