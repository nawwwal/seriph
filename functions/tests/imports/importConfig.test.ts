import { describe, expect, it } from "vitest";
import { getImportConfig } from "../../src/imports/config/importConfig";

const SAFE_LIMITS = {
  sourceTimeoutMinutes: 1440,
  archiveMaxDepth: 4,
  archiveMaxEntries: 10000,
  archiveMaxExpandedBatchBytes: 2147483648,
  archiveMaxEntryBytes: 268435456,
  archiveMaxCompressionRatio: 100,
  archiveMaxPathBytes: 1024,
  inlineZipBytes: 157286400,
  maxSourceBytes: 536870912,
};

describe("import configuration", () => {
  it("returns the approved limits and clamps invalid remote values", () => {
    expect(getImportConfig(() => undefined)).toMatchObject({
      enabled: true,
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

  it.each([
    ["blank", ""],
    ["whitespace", " \t "],
    ["negative", "-1"],
    ["non-finite", "Infinity"],
    ["non-integer", "1.5"],
  ])("uses safe limit defaults for %s numeric values", (_, value) => {
    expect(getImportConfig(() => value)).toMatchObject(SAFE_LIMITS);
  });

  it.each([
    ["a malformed tuple", "300,1800"],
    ["an invalid tuple element", "300,nope,7200"],
    ["a blank tuple element", "300, ,7200"],
    ["a non-integer tuple element", "300,1800,1.5"],
  ])("uses safe retry defaults for %s", (_, value) => {
    expect(getImportConfig(() => value).enrichmentRetrySeconds).toEqual([300, 1800, 7200]);
  });
});
