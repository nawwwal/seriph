import { describe, expect, it, vi } from "vitest";
import {
  reconcileBatch,
  type ReconcileBatchDependencies,
} from "../../src/imports/reconcile/reconcileBatch";
import { AggregateReadOverflowError } from "../../src/storage/paginatedRead";

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

  it("waits for every descendant and lifecycle collection before cleanup", async () => {
    const deleteContainers = vi.fn(async (_ref: unknown, paths: readonly string[]) => paths.map((path) => ({ path, kind: "deleted" as const })));
    const parent = { state: "classified", storagePath: "intake/owner-1/batch-1/archive.zip", archive: {
      state: "expanding", inventoryDurable: true, expectedChildren: 1, terminalChildren: 0,
    } };
    const child = { state: "classified", stagingPath: "import_staging/owner-1/batch-1/font.ttf" };
    const deps: ReconcileBatchDependencies = {
      listSources: async () => [{ state: "discovered", storagePath: parent.storagePath }],
      listItems: async () => [parent, child], listPlans: async () => [{ state: "applied" }],
      listMutations: async () => [{ status: "committed" }], listEnrichments: async () => [{ state: "complete" }],
      writeBatch: vi.fn(async () => undefined), rebuildSummary: vi.fn(async () => undefined), deleteContainers,
    };

    await reconcileBatch(batchRef, deps);
    expect(deleteContainers).not.toHaveBeenCalled();

    parent.archive.state = "complete";
    parent.archive.terminalChildren = 1;
    await reconcileBatch(batchRef, deps);
    expect(deleteContainers).toHaveBeenCalledOnce();
  });

  it("turns an aggregate read overflow into a review without cleanup", async () => {
    const writeBatch = vi.fn(async () => undefined);
    const deleteContainers = vi.fn(async () => []);
    const deps: ReconcileBatchDependencies = {
      listSources: async () => { throw new AggregateReadOverflowError("items", 100_000); },
      listItems: async () => [], listPlans: async () => [], listMutations: async () => [], listEnrichments: async () => [],
      writeBatch, rebuildSummary: vi.fn(async () => undefined), deleteContainers,
    };

    await expect(reconcileBatch(batchRef, deps)).resolves.toMatchObject({ outcome: "needs_review", reviewItems: 1 });
    expect(writeBatch).toHaveBeenCalledWith(batchRef, expect.objectContaining({ audit: expect.objectContaining({ aggregateReadOverflow: "items" }) }));
    expect(deleteContainers).not.toHaveBeenCalled();
  });
});
