import { describe, expect, it } from "vitest";
import { applyRecoveryAction, parseReconcileArgs, runReconcileImportPipeline, snapshotFamilyDoc, snapshotIngestDoc } from "../../src/scripts/reconcileImportPipeline";
import { planPipelineRecovery, type RecoverySnapshot } from "../../src/scripts/pipelineRecoveryPlan";

const fixture: RecoverySnapshot = {
  families: [
    { id: "chap", version: 1, status: "ready", faces: [] },
    { id: "old-alias", ownerId: "u1", version: 4, status: "enriching", faces: [{}], hidden: true, aliasOf: "canonical" },
    { id: "canonical", ownerId: "u1", version: 3, status: "ready", faces: [{}], recoveryRequeued: true },
  ],
  ingests: [{ ownerId: "u1", ingestId: "i1", familyId: "canonical", analysisState: "enriching" }],
};

describe("planPipelineRecovery", () => {
  it("quarantines legacy chap, restores aliases, and resolves stale ingests", () => {
    expect(planPipelineRecovery(fixture)).toEqual([
      { kind: "quarantine_family", familyId: "chap", reason: "missing_owner_and_faces" },
      { kind: "restore_alias", familyId: "old-alias", targetId: "u1__canonical" },
      { kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "complete" },
    ]);
  });

  it("does not plan a requeue for an ownerless legacy family", () => { expect(planPipelineRecovery({ families: [{ id: "legacy", status: "ready", faces: [{}] }], ingests: [] })).toEqual([]); });

  it("plans quarantine for only the ownerless malformed chap family", () => { expect(planPipelineRecovery({ families: [{ id: "chap", status: "ready", faces: [] }], ingests: [] })).toEqual([{ kind: "quarantine_family", familyId: "chap", reason: "missing_owner_and_faces" }]); });

  it("normalizes a slug-only legacy alias target from its owner", () => { expect(planPipelineRecovery({ families: [{ id: "u1__old-alias", ownerId: "u1", status: "enriching", faces: [{}], hidden: true, aliasOf: "canonical" }], ingests: [] })).toEqual([{ kind: "restore_alias", familyId: "u1__old-alias", targetId: "u1__canonical" }]); });

  it("does not plan an alias restore for an ownerless source", () => { expect(planPipelineRecovery({ families: [{ id: "legacy", status: "enriching", faces: [{}], hidden: true, aliasOf: "u1__canonical" }], ingests: [] })).toEqual([]); });

  it("plans failed recovery when an ingest has no related family", () => { expect(planPipelineRecovery({ families: [], ingests: [{ ownerId: "u1", ingestId: "i1", familyId: "u1__missing", analysisState: "enriching" }] })).toEqual([{ kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "failed" }]); });
});

describe("reconcile safety", () => {
  it("requires scoped apply and rejects unknown arguments", () => {
    expect(() => parseReconcileArgs(["--apply"])).toThrow("owner");
    expect(() => parseReconcileArgs(["--wat"])).toThrow("Unknown");
    expect(parseReconcileArgs(["--apply", "--ownerId=u1"]).allOwners).toBe(false);
    expect(parseReconcileArgs(["--apply", "--allOwners"]).allOwners).toBe(true);
  });

  it("does not apply writes during a dry run", async () => {
    let applied = 0;
    await runReconcileImportPipeline(["--dryRun"], {
      readSnapshot: async () => fixture,
      applyAction: async () => { applied += 1; },
      log: () => undefined,
    });
    expect(applied).toBe(0);
  });

  it("uses the authoritative family path, validates the target, and audits once", async () => {
    const db = new FakeDb();
    db.put("fontfamilies/u1__canonical", { status: "ready", hidden: false, faces: [{}], version: 2 });
    db.put("fontfamilies/u1__old-alias", { status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 4 });
    const snapshot = { families: [{ id: "u1__old-alias", firestorePath: "fontfamilies/u1__old-alias", ownerId: "u1", status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 4 }], ingests: [] } as RecoverySnapshot;
    const action = { kind: "restore_alias", familyId: "u1__old-alias", targetId: "u1__canonical" } as const;
    await applyRecoveryAction(action, snapshot, db as never);
    await applyRecoveryAction(action, snapshot, db as never);
    expect(db.writes.filter((path) => path === "fontfamilies/u1__old-alias")).toHaveLength(1);
    expect(db.writes.filter((path) => path === "pipelineRecoveryAudits/restore_alias_u1__old-alias_u1__canonical")).toHaveLength(1);
  });

  it("rejects a missing or cross-owner alias target and stale family state", async () => {
    const db = new FakeDb();
    db.put("fontfamilies/u1__alias", { status: "enriching", hidden: true, aliasOfId: "u2__canonical", version: 1 });
    const snapshot = { families: [{ id: "u1__alias", firestorePath: "fontfamilies/u1__alias", ownerId: "u1", status: "enriching", hidden: true, aliasOfId: "u2__canonical", faces: [{}], version: 1 }], ingests: [] } as RecoverySnapshot;
    await expect(applyRecoveryAction({ kind: "restore_alias", familyId: "u1__alias", targetId: "u2__canonical" }, snapshot, db as never)).rejects.toThrow("owner");
    db.put("fontfamilies/u1__canonical", { status: "ready", hidden: false, faces: [{}], version: 2 });
    db.put("fontfamilies/u1__alias", { status: "ready", hidden: true, aliasOfId: "u1__canonical", version: 1 });
    await expect(applyRecoveryAction({ kind: "restore_alias", familyId: "u1__alias", targetId: "u1__canonical" }, snapshot, db as never)).rejects.toThrow("replan");
  });

  it("rejects a target that is already an alias", async () => {
    const db = new FakeDb();
    db.put("fontfamilies/u1__alias", { status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 1 });
    db.put("fontfamilies/u1__canonical", { status: "ready", aliasOf: "u1__other", faces: [{}], version: 2 });
    const snapshot = { families: [{ id: "u1__alias", firestorePath: "fontfamilies/u1__alias", ownerId: "u1", status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 1 }], ingests: [] } as RecoverySnapshot;
    await expect(applyRecoveryAction({ kind: "restore_alias", familyId: "u1__alias", targetId: "u1__canonical" }, snapshot, db as never)).rejects.toThrow("invalid alias target");
  });

  it("rejects direct apply for an ownerless family source", async () => { const db = new FakeDb(); db.put("fontfamilies/legacy", { status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 1 }); db.put("fontfamilies/u1__canonical", { status: "ready", hidden: false, faces: [{}], version: 2 }); const snapshot = { families: [{ id: "legacy", firestorePath: "fontfamilies/legacy", status: "enriching", hidden: true, aliasOfId: "u1__canonical", faces: [{}], version: 1 }], ingests: [] } as RecoverySnapshot; await expect(applyRecoveryAction({ kind: "restore_alias", familyId: "legacy", targetId: "u1__canonical" }, snapshot, db as never)).rejects.toThrow("path_identity"); });

  it("rejects direct apply for ownerless requeue and quarantine", async () => { const snapshot = { families: [{ id: "legacy", firestorePath: "fontfamilies/legacy", status: "ready", faces: [], version: 1 }], ingests: [] } as RecoverySnapshot; for (const action of [{ kind: "requeue_family", familyId: "legacy", version: 1 }, { kind: "quarantine_family", familyId: "legacy", reason: "missing_owner_and_faces" }] as const) { const db = new FakeDb(); db.put("fontfamilies/legacy", { status: "ready", faces: [], version: 1 }); await expect(applyRecoveryAction(action, snapshot, db as never)).rejects.toThrow("path_identity"); } });

  it("allows only the exact guarded ownerless chap quarantine and audits once", async () => { const snapshot = { families: [{ id: "chap", firestorePath: "fontfamilies/chap", status: "ready", faces: [], faceCount: 0, version: 1 }], ingests: [] } as RecoverySnapshot; const action = { kind: "quarantine_family", familyId: "chap", reason: "missing_owner_and_faces" } as const; const db = new FakeDb(); db.put("fontfamilies/chap", { status: "ready", faces: [], version: 1 }); await applyRecoveryAction(action, snapshot, db as never); await applyRecoveryAction(action, snapshot, db as never); expect(db.writes.filter((path) => path === "fontfamilies/chap")).toHaveLength(1); expect(db.writes.filter((path) => path === "pipelineRecoveryAudits/quarantine_family_chap_missing_owner_and_faces")).toHaveLength(1); const invalid = new FakeDb(); invalid.put("fontfamilies/chap", { status: "ready", faces: [], version: 1 }); await expect(applyRecoveryAction({ ...action, reason: "other" }, snapshot, invalid as never)).rejects.toThrow("path_identity"); });

  it("takes family and ingest identity from Firestore paths", () => { const db = new FakeDb(); expect(snapshotFamilyDoc({ ref: new FakeRef("fontfamilies/u1__canonical", db), data: () => ({ id: "wrong", ownerId: "u2", faces: [] }) })).toMatchObject({ id: "u1__canonical", ownerId: "u1" }); expect(snapshotIngestDoc({ ref: new FakeRef("users/u1/ingests/i1", db), data: () => ({ ingestId: "wrong", ownerId: "u2" }) })).toMatchObject({ ingestId: "i1", ownerId: "u1" }); });

  it("rejects a missing alias target", async () => { const db = new FakeDb(); db.put("fontfamilies/u1__alias", { status: "enriching", hidden: true, aliasOfId: "u1__missing", faces: [{}], version: 1 }); const snapshot = { families: [{ id: "u1__alias", firestorePath: "fontfamilies/u1__alias", ownerId: "u1", status: "enriching", hidden: true, aliasOfId: "u1__missing", faces: [{}], version: 1 }], ingests: [] } as RecoverySnapshot; await expect(applyRecoveryAction({ kind: "restore_alias", familyId: "u1__alias", targetId: "u1__missing" }, snapshot, db as never)).rejects.toThrow("invalid alias target"); });

  it("guards ingest writes by path and every captured state field", async () => {
    const family = { id: "u1__canonical", ownerId: "u1", firestorePath: "fontfamilies/u1__canonical", status: "ready", hidden: false, faces: [{}], version: 1, recoveryRequeued: true };
    const db = new FakeDb(); db.put(family.firestorePath, family); db.put("users/u1/ingests/i1", { analysisState: "enriching", status: "processing", familyId: "u1__canonical", processingId: "p1", batchId: "b1" });
    const snapshot = { families: [family], ingests: [{ ownerId: "u1", ingestId: "i1", firestorePath: "users/u1/ingests/i1", analysisState: "enriching", status: "processing", familyId: "u1__canonical", processingId: "p1", batchId: "b1" }] } as RecoverySnapshot;
    const action = { kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "complete" } as const;
    await applyRecoveryAction(action, snapshot, db as never); expect(db.writes).toContain("users/u1/ingests/i1");
    const stale = new FakeDb(); stale.put(family.firestorePath, family); stale.put("users/u1/ingests/i1", { analysisState: "queued", status: "processing", familyId: "u1__canonical", processingId: "p1", batchId: "b1" });
    await expect(applyRecoveryAction(action, snapshot, stale as never)).rejects.toThrow("ingest_state");
  });

  it("rejects family recovery marker and rejection drift", async () => { const family = { id: "u1__canonical", ownerId: "u1", firestorePath: "fontfamilies/u1__canonical", status: "ready", hidden: false, faces: [{}], version: 1, recoveryRequeued: false }; const snapshot = { families: [family], ingests: [] } as RecoverySnapshot; const action = { kind: "requeue_family", familyId: family.id, version: 1 } as const; const requeued = new FakeDb(); requeued.put(family.firestorePath, { ...family, recoveryRequeued: true }); await expect(applyRecoveryAction(action, snapshot, requeued as never)).rejects.toThrow("family_state"); const rejected = new FakeDb(); rejected.put(family.firestorePath, { ...family, enrichmentSubmissionRejection: { code: "new_rejection" } }); await expect(applyRecoveryAction(action, snapshot, rejected as never)).rejects.toThrow("family_state"); });

  it("rejects ingest completion when its related family drifts", async () => { const family = { id: "u1__canonical", ownerId: "u1", firestorePath: "fontfamilies/u1__canonical", status: "ready", hidden: false, faces: [{}], version: 1, recoveryRequeued: true }; const ingest = { ownerId: "u1", ingestId: "i1", firestorePath: "users/u1/ingests/i1", analysisState: "enriching", status: "processing", familyId: family.id, processingId: "p1", batchId: "b1" }; const snapshot = { families: [family], ingests: [ingest] } as RecoverySnapshot; const action = { kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "complete" } as const; const stale = new FakeDb(); stale.put(family.firestorePath, { ...family, status: "failed" }); stale.put(ingest.firestorePath, ingest); await expect(applyRecoveryAction(action, snapshot, stale as never)).rejects.toThrow("family_state"); });

  it("applies terminal failed recovery without a related family", async () => { const db = new FakeDb(); const ingest = { ownerId: "u1", ingestId: "i1", firestorePath: "users/u1/ingests/i1", analysisState: "enriching", status: "processing", familyId: "u1__missing", processingId: "p1", batchId: "b1" }; db.put(ingest.firestorePath, ingest); const snapshot = { families: [], ingests: [ingest] } as RecoverySnapshot; await applyRecoveryAction({ kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "failed" }, snapshot, db as never); expect(db.writes).toContain(ingest.firestorePath); });
});

class FakeRef { constructor(readonly path: string, private readonly db: FakeDb) {} get id() { return this.path.split("/").pop()!; } collection(name: string) { return { doc: (id: string) => new FakeRef(`${this.path}/${name}/${id}`, this.db) }; } async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path), ref: this }; } }
class FakeTx { constructor(private readonly db: FakeDb) {} get = (ref: FakeRef) => ref.get(); set = (ref: FakeRef, data: Record<string, unknown>) => { this.db.writes.push(ref.path); this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); }; }
class FakeDb { docs = new Map<string, Record<string, unknown>>(); writes: string[] = []; put(path: string, data: Record<string, unknown>) { this.docs.set(path, data); } doc = (path: string) => new FakeRef(path, this); collection = (name: string) => ({ doc: (id: string) => new FakeRef(`${name}/${id}`, this) }); runTransaction = async <T>(run: (tx: FakeTx) => Promise<T>) => run(new FakeTx(this)); }
