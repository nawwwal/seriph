import { familySlug } from "../storage/canonicalize";
import { catalogFamilyDocId } from "../storage/catalogIdentity";

export type UnknownRecord = Record<string, unknown>;
export const OLD_SCHEMA_MIGRATION_VERSION = "2026-06-old-schema-fonts";

export interface MigrationArgs {
  ownerId?: string;
  familyIds?: string[];
  limit?: number;
  dryRun: boolean;
  force: boolean;
  recomputeVectors: boolean;
  allOwners: boolean;
}

export interface LegacyFontSource {
  fontId: string;
  filename: string;
  bucketName?: string;
  storagePath: string;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(record: UnknownRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function catalogDocIdArg(value: string, ownerId: string | undefined): string {
  const trimmed = value.trim();
  if (!ownerId && trimmed.includes("__")) return trimmed;
  return catalogFamilyDocId(ownerId, familySlug(trimmed));
}

export function parseMigrationArgs(argv: string[]): MigrationArgs {
  const parsed: MigrationArgs = { dryRun: false, force: false, recomputeVectors: true, allOwners: false };
  for (const arg of argv) {
    if (arg === "--dryRun") parsed.dryRun = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--skipVectors") parsed.recomputeVectors = false;
    else if (arg === "--allOwners") parsed.allOwners = true;
    else if (arg.startsWith("--ownerId=")) parsed.ownerId = arg.slice("--ownerId=".length);
    else if (arg.startsWith("--familyIds=")) parsed.familyIds = unique(arg.slice("--familyIds=".length).split(","));
    else if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (Number.isInteger(limit) && limit > 0) parsed.limit = limit;
    }
  }
  return parsed;
}
