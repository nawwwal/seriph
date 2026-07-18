import { describe, expect, it } from "vitest";
import { BatchTerminalSummary } from "../../src/imports/contracts/batch";
import { deriveBatchOutcome } from "../../src/imports/state/deriveBatchOutcome";

const fullSummary = (
  summary: Partial<BatchTerminalSummary>,
): BatchTerminalSummary => ({
  appliedFamilies: 0,
  canceled: 0,
  duplicates: 0,
  failures: 0,
  nonterminal: 0,
  review: 0,
  ...summary,
});

describe("deriveBatchOutcome", () => {
  it.each([
    [{ nonterminal: 1 }, "active"],
    [{ canceled: 1, appliedFamilies: 1 }, "canceled"],
    [{ review: 1, appliedFamilies: 1 }, "needs_review"],
    [{ failures: 1, appliedFamilies: 1 }, "partial"],
    [{ failures: 1, appliedFamilies: 0 }, "failed"],
    [{ duplicates: 3 }, "succeeded"],
  ] as const)("derives %s as %s", (input, expected) => {
    expect(deriveBatchOutcome(fullSummary(input))).toBe(expected);
  });
});
