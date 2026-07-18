import { BatchTerminalSummary, ImportBatchOutcome } from "../contracts/batch";

export function deriveBatchOutcome(
  summary: BatchTerminalSummary,
): ImportBatchOutcome {
  if (summary.nonterminal > 0) return "active";
  if (summary.canceled > 0) return "canceled";
  if (summary.review > 0) return "needs_review";
  if (summary.failures > 0 && summary.appliedFamilies > 0) return "partial";
  if (summary.failures > 0 && summary.appliedFamilies === 0) return "failed";
  return "succeeded";
}
