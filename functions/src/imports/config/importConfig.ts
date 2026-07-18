import { RC_DEFAULTS, RC_KEYS } from "../../config/rcKeys";
import { getConfigValue } from "../../config/remoteConfig";

export interface ImportConfig {
  enabled: boolean;
  sourceTimeoutMinutes: number;
  archiveMaxDepth: number;
  archiveMaxEntries: number;
  archiveMaxExpandedBatchBytes: number;
  archiveMaxEntryBytes: number;
  archiveMaxCompressionRatio: number;
  archiveMaxPathBytes: number;
  inlineZipBytes: number;
  maxSourceBytes: number;
  enrichmentRetrySeconds: [number, number, number];
}

export type ImportConfigReader = (key: string, fallback: string) => string | undefined;
type ImportKey = keyof typeof RC_DEFAULTS;

const IMPORT_LIMITS = {
  sourceTimeoutMinutes: RC_KEYS.importSourceTimeoutMinutes,
  archiveMaxDepth: RC_KEYS.importArchiveMaxDepth,
  archiveMaxEntries: RC_KEYS.importArchiveMaxEntries,
  archiveMaxExpandedBatchBytes: RC_KEYS.importArchiveMaxExpandedBatchBytes,
  archiveMaxEntryBytes: RC_KEYS.importArchiveMaxEntryBytes,
  archiveMaxCompressionRatio: RC_KEYS.importArchiveMaxCompressionRatio,
  archiveMaxPathBytes: RC_KEYS.importArchiveMaxPathBytes,
  inlineZipBytes: RC_KEYS.importInlineZipBytes,
  maxSourceBytes: RC_KEYS.importMaxSourceBytes,
} as const;

function valueFor(read: ImportConfigReader, key: ImportKey): string {
  return read(key, RC_DEFAULTS[key]) ?? RC_DEFAULTS[key];
}

function bounded(read: ImportConfigReader, key: ImportKey): number {
  const ceiling = Number(RC_DEFAULTS[key]);
  const value = Number(valueFor(read, key));
  return Number.isFinite(value) && value >= 0 ? Math.min(value, ceiling) : ceiling;
}

function retrySeconds(read: ImportConfigReader): [number, number, number] {
  const fallback = RC_DEFAULTS[RC_KEYS.enrichmentRetrySeconds].split(",").map(Number);
  const values = valueFor(read, RC_KEYS.enrichmentRetrySeconds).split(",").map(Number);
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  return [Math.min(values[0], fallback[0]), Math.min(values[1], fallback[1]), Math.min(values[2], fallback[2])];
}

function enabled(read: ImportConfigReader): boolean {
  return ["true", "1", "yes", "y", "on"].includes(
    valueFor(read, RC_KEYS.durableImportEnabled).trim().toLowerCase(),
  );
}

export function getImportConfig(read: ImportConfigReader = getConfigValue): ImportConfig {
  return Object.freeze({
    enabled: enabled(read),
    sourceTimeoutMinutes: bounded(read, IMPORT_LIMITS.sourceTimeoutMinutes),
    archiveMaxDepth: bounded(read, IMPORT_LIMITS.archiveMaxDepth),
    archiveMaxEntries: bounded(read, IMPORT_LIMITS.archiveMaxEntries),
    archiveMaxExpandedBatchBytes: bounded(read, IMPORT_LIMITS.archiveMaxExpandedBatchBytes),
    archiveMaxEntryBytes: bounded(read, IMPORT_LIMITS.archiveMaxEntryBytes),
    archiveMaxCompressionRatio: bounded(read, IMPORT_LIMITS.archiveMaxCompressionRatio),
    archiveMaxPathBytes: bounded(read, IMPORT_LIMITS.archiveMaxPathBytes),
    inlineZipBytes: bounded(read, IMPORT_LIMITS.inlineZipBytes),
    maxSourceBytes: bounded(read, IMPORT_LIMITS.maxSourceBytes),
    enrichmentRetrySeconds: Object.freeze(retrySeconds(read)) as [number, number, number],
  }) as ImportConfig;
}
