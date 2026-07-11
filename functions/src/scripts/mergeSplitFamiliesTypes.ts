import { familySlug } from "../storage/canonicalize";
import { catalogFamilyDocId } from "../storage/catalogIdentity";
import type { FontFace, FontFamilyDoc } from "../models/catalog.models";

export interface MergeArgs {
  apply: boolean;
  ownerId?: string;
  familyIds?: string[];
  limit?: number;
  force: boolean;
  skipConflicts: boolean;
  reparseOriginals: boolean;
  reparseConcurrency?: number;
  batchWrites?: number;
}

export interface AliasPlan {
  sourceSlug: string;
  sourceDocId: string;
  targetSlug: string;
  targetDocId: string;
}

export interface MergeConflict {
  targetSlug: string;
  faceId: string;
  sources: string[];
}

export interface MergeTarget {
  docId: string;
  slug: string;
  name: string;
  fileBase: string;
  ownerId?: string;
  category: FontFamilyDoc["category"];
  sourceSlugs: string[];
  aliases: string[];
  aliasDocIds: string[];
  faces: FontFace[];
  base?: FontFamilyDoc;
}

export interface SplitFamilyMergePlan {
  targets: MergeTarget[];
  aliases: AliasPlan[];
  conflicts: MergeConflict[];
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function catalogDocIdArg(value: string, ownerId: string | undefined): string {
  const trimmed = value.trim();
  if (!ownerId && trimmed.includes("__")) return trimmed;
  return catalogFamilyDocId(ownerId, familySlug(trimmed));
}

export function parseMergeArgs(argv: string[]): MergeArgs {
  const args: MergeArgs = { apply: false, force: false, skipConflicts: false, reparseOriginals: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--skipConflicts") args.skipConflicts = true;
    else if (arg === "--reparseOriginals") args.reparseOriginals = true;
    else if (arg.startsWith("--reparseConcurrency=")) {
      const concurrency = Number(arg.slice("--reparseConcurrency=".length));
      if (Number.isInteger(concurrency) && concurrency > 0) args.reparseConcurrency = concurrency;
    }
    else if (arg.startsWith("--batchWrites=")) {
      const batchWrites = Number(arg.slice("--batchWrites=".length));
      if (Number.isInteger(batchWrites) && batchWrites > 0) args.batchWrites = batchWrites;
    }
    else if (arg.startsWith("--ownerId=")) args.ownerId = arg.slice("--ownerId=".length);
    else if (arg.startsWith("--familyIds=")) args.familyIds = unique(arg.slice("--familyIds=".length).split(","));
    else if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (Number.isInteger(limit) && limit > 0) args.limit = limit;
    }
  }
  return args;
}
