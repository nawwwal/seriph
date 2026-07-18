import { describe, expect, it } from "vitest";
import { getImportConfig } from "../../src/imports/config/importConfig";

describe("import configuration", () => {
  it("returns the approved limits and clamps invalid remote values", () => {
    expect(getImportConfig(() => undefined)).toMatchObject({
      enabled: false,
      sourceTimeoutMinutes: 1440,
      archiveMaxDepth: 4,
      archiveMaxEntries: 10000,
      archiveMaxExpandedBatchBytes: 2147483648,
      archiveMaxEntryBytes: 268435456,
      archiveMaxCompressionRatio: 100,
      archiveMaxPathBytes: 1024,
      inlineZipBytes: 157286400,
      maxSourceBytes: 536870912,
      enrichmentRetrySeconds: [300, 1800, 7200],
    });

    const config = getImportConfig(() => "999999999999");

    expect(config).toMatchObject({
      enabled: false,
      sourceTimeoutMinutes: 1440,
      archiveMaxDepth: 4,
      archiveMaxEntries: 10000,
      archiveMaxExpandedBatchBytes: 2147483648,
      archiveMaxEntryBytes: 268435456,
      archiveMaxCompressionRatio: 100,
      archiveMaxPathBytes: 1024,
      inlineZipBytes: 157286400,
      maxSourceBytes: 536870912,
      enrichmentRetrySeconds: [300, 1800, 7200],
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.enrichmentRetrySeconds)).toBe(true);
    expect(getImportConfig(() => "Infinity").sourceTimeoutMinutes).toBe(1440);
  });
});
