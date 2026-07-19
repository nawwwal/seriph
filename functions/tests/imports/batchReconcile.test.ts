import { describe, expect, it, vi } from "vitest";
import {
  reconcileBatch,
  type ReconcileBatchDependencies,
} from "../../src/imports/reconcile/reconcileBatch";
import {
  rollbackMutation,
  type RollbackDependencies,
} from "../../src/imports/apply/rollbackMutation";

const batchRef = { path: "users/owner-1/importBatches/batch-1" } as never;

function reconcileDeps(): ReconcileBatchDependencies {
  return {
    listSources: async () => [{ state: "discovered" }],
    listItems: async () => [
      { state: "applied", familyId: "atlas" },
      { state: "review", itemId: "review-1" },
    ],
    listPlans: async () => [{ state: "applied", familyIds: ["atlas", "benton"] }],
    listMutations: async () => [
      { status: "committed", familyId: "atlas" },
      { status: "committed", familyId: "benton" },
    ],
    listEnrichments: async () => [{ state: "complete" }],
    writeBatch: vi.fn(async () => undefined),
    rebuildSummary: vi.fn(async () => undefined),
  };
}

describe("import batch reconciliation", () => {
  it("derives counters from children and rebuilds the catalogue summary once", async () => {
    const deps = reconcileDeps();
    const result = await reconcileBatch(batchRef, deps);

    expect(result).toMatchObject({
      outcome: "needs_review",
      cataloguedFamilies: 2,
      reviewItems: 1,
    });
    expect(deps.rebuildSummary).toHaveBeenCalledTimes(1);
    expect(deps.writeBatch).toHaveBeenCalledWith(
      batchRef,
      expect.objectContaining({ outcome: "needs_review" }),
    );
  });

  it("coalesces repeated summary invalidation for one owner and batch", async () => {
    const deps = reconcileDeps();
    await Promise.all([
      reconcileBatch(batchRef, deps),
      reconcileBatch(batchRef, deps),
    ]);

    expect(deps.rebuildSummary).toHaveBeenCalledTimes(1);
  });
});

describe("mutation rollback", () => {
  it("refuses rollback after a later family version", async () => {
    const deps: RollbackDependencies = {
      deleteAsset: vi.fn(async () => undefined),
      createReviewItem: vi.fn(async () => undefined),
    };
    const oldMutation = {
      mutationId: "mutation-1",
      familyId: "atlas",
      familyVersion: 4,
      introducedAssetIds: ["asset-1"],
    };
    const currentFamily = { id: "atlas", version: 5, faces: [] };

    expect(await rollbackMutation(oldMutation, currentFamily, deps)).toEqual({
      kind: "review_required",
    });
    expect(deps.deleteAsset).not.toHaveBeenCalled();
    expect(deps.createReviewItem).toHaveBeenCalledOnce();
  });

  it("removes only assets introduced by the guarded mutation", async () => {
    const deleted: string[] = [];
    const deps: RollbackDependencies = {
      deleteAsset: async (assetId) => { deleted.push(assetId); },
      createReviewItem: async () => undefined,
    };
    const mutation = {
      mutationId: "mutation-1",
      familyId: "atlas",
      familyVersion: 4,
      introducedAssetIds: ["asset-1"],
    };

    await expect(rollbackMutation(mutation, { id: "atlas", version: 4, faces: [] }, deps))
      .resolves.toEqual({ kind: "rolled_back", familyVersion: 4 });
    expect(deleted).toEqual(["asset-1"]);
  });
});
