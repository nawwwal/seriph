import { describe, expect, it } from "vitest";
import { parseHistoricalMigrationArgs, planHistoricalImportMigration } from "../../src/scripts/migrateHistoricalImportsPlanner";

const record = (overrides: Record<string, unknown> = {}) => ({ firestorePath: "users/u1/ingests/i1", ownerId: "u1", ingestId: "i1", batchId: "old-batch", originalName: "Inter-Regular.otf", status: "completed", ...overrides });

describe("history-only import migration planner", () => {
  it("defaults to a deterministic dry run without inventing inventory", () => {
    const plan = planHistoricalImportMigration([record()])[0]!;
    expect(plan).toEqual(planHistoricalImportMigration([record()])[0]);
    expect(plan.batch).toMatchObject({ historyOnly: true, outcome: "succeeded", expectedSourceCount: 1, counters: { discoveredItems: 0, fonts: 0, families: 0 } });
    expect(plan.sources[0]).toMatchObject({ historyOnly: true, state: "discovered", storagePath: "", originalPath: "Inter-Regular.otf" });
    expect(plan.batch).not.toHaveProperty("items");
  });

  it("groups known batches and marks unfinished history for review", () => {
    const plan = planHistoricalImportMigration([record(), record({ firestorePath: "users/u1/ingests/i2", ingestId: "i2", status: "processing" })])[0]!;
    expect(plan.sources).toHaveLength(2);
    expect(plan.batch).toMatchObject({ outcome: "needs_review", counters: { review: 1, warnings: 1 } });
  });

  it("requires an explicit owner scope and apply flag", () => {
    expect(parseHistoricalMigrationArgs([])).toEqual({ allOwners: false, dryRun: true });
    expect(parseHistoricalMigrationArgs(["--ownerId=u1", "--apply", "--limit=4"])).toEqual({ ownerId: "u1", allOwners: false, dryRun: false, limit: 4 });
  });
});
