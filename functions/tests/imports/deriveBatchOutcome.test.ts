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
    [{ failures: 1, appliedFamilies: 0 }, "failed"],
    [{ duplicates: 3 }, "succeeded"],
  ] as const)("derives %s as %s", (input, expected) => {
    expect(deriveBatchOutcome(fullSummary(input))).toBe(expected);
  });

  it.each([
    ["active overrides canceled", { nonterminal: 1, canceled: 1 }, "active"],
    ["canceled overrides review", { canceled: 1, review: 1 }, "canceled"],
    ["review overrides partial", { review: 1, failures: 1, appliedFamilies: 1 }, "needs_review"],
    ["partial overrides failed", { failures: 1, appliedFamilies: 1 }, "partial"],
  ] as const)("%s", (_case, input, expected) => {
    expect(deriveBatchOutcome(fullSummary(input))).toBe(expected);
  });
});
