import { describe, expect, it } from "vitest";
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
  it("quarantines malformed canonicals, restores aliases, and resolves stale ingests", () => {
    expect(planPipelineRecovery(fixture)).toEqual([
      { kind: "quarantine_family", familyId: "chap", reason: "missing_owner_and_faces" },
      { kind: "restore_alias", familyId: "old-alias", targetId: "canonical" },
      { kind: "resolve_ingest", ownerId: "u1", ingestId: "i1", state: "complete" },
    ]);
  });
});
