import { describe, expect, it, vi } from "vitest";
import { rollbackMutation, type RollbackDependencies } from "../../src/imports/apply/rollbackMutation";

const mutation = { mutationId: "mutation-1", familyId: "atlas", familyVersion: 4, introducedAssetIds: ["asset-1"] };
const proof = async () => true;

describe("mutation rollback", () => {
  it("refuses rollback after a later family version", async () => {
    const deps: RollbackDependencies = { deleteAsset: vi.fn(async () => undefined), createReviewItem: vi.fn(async () => undefined), assetSolelyIntroduced: proof, compareAndSetRollback: vi.fn(async () => ({ kind: "rolled_back" })) };
    await expect(rollbackMutation(mutation, { id: "atlas", version: 5 }, deps)).resolves.toEqual({ kind: "review_required" });
    expect(deps.deleteAsset).not.toHaveBeenCalled();
  });

  it("requires the exact family identity before attempting the rollback CAS", async () => {
    const deps: RollbackDependencies = { deleteAsset: vi.fn(async () => undefined), createReviewItem: vi.fn(async () => undefined), assetSolelyIntroduced: proof, compareAndSetRollback: vi.fn(async () => ({ kind: "rolled_back" })) };
    await expect(rollbackMutation(mutation, { version: 4 }, deps)).resolves.toEqual({ kind: "review_required" });
    expect(deps.compareAndSetRollback).not.toHaveBeenCalled();
  });

  it("does not delete after the transactional rollback CAS detects a conflict", async () => {
    const deleted: string[] = []; const deps: RollbackDependencies = {
      deleteAsset: async (assetId) => { deleted.push(assetId); }, createReviewItem: vi.fn(async () => undefined), assetSolelyIntroduced: proof,
      compareAndSetRollback: vi.fn(async () => ({ kind: "conflict" })),
    };
    await expect(rollbackMutation(mutation, { id: "atlas", version: 4 }, deps)).resolves.toEqual({ kind: "review_required" });
    expect(deleted).toEqual([]);
  });

  it("removes only assets introduced by the guarded mutation", async () => {
    const deleted: string[] = []; const deps: RollbackDependencies = {
      deleteAsset: async (assetId) => { deleted.push(assetId); }, createReviewItem: async () => undefined, assetSolelyIntroduced: proof,
      compareAndSetRollback: async () => ({ kind: "rolled_back" }),
    };
    await expect(rollbackMutation(mutation, { id: "atlas", version: 4 }, deps)).resolves.toEqual({ kind: "rolled_back", familyVersion: 4 });
    expect(deleted).toEqual(["asset-1"]);
  });

  it("does not delete an asset without a sole-introduction proof", async () => {
    const deleted: string[] = []; const deps: RollbackDependencies = {
      deleteAsset: async (assetId) => { deleted.push(assetId); }, createReviewItem: vi.fn(async () => undefined), assetSolelyIntroduced: async () => false,
      compareAndSetRollback: vi.fn(async () => ({ kind: "rolled_back" })),
    };
    await expect(rollbackMutation(mutation, { id: "atlas", version: 4 }, deps)).resolves.toEqual({ kind: "review_required" });
    expect(deleted).toEqual([]); expect(deps.compareAndSetRollback).not.toHaveBeenCalled();
  });
});
