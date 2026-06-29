import { embeddingDims, embeddingModelId } from "../ai/embeddings";
import { PROMPT_VERSION } from "../ai/enrich/schema";
import type { FontFamilyDoc } from "../models/catalog.models";
import { isSearchIndexedAtVersion } from "../search/searchDocument";
import { buildVersionedBackfillUpdate } from "./backfillSearchVectorUpdate";
export interface BackfillArgs {
  ownerId?: string;
  limit?: number;
  force: boolean;
  dryRun: boolean;
}
export interface SearchVersionForBackfill {
  embeddingVersion: string;
  promptVersion: string;
}
export function parseBackfillArgs(argv: string[]): BackfillArgs {
  const parsed: BackfillArgs = { force: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--force") parsed.force = true;
    else if (arg === "--dryRun") parsed.dryRun = true;
    else if (arg.startsWith("--ownerId=")) parsed.ownerId = arg.slice("--ownerId=".length);
    else if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (Number.isInteger(limit) && limit > 0) parsed.limit = limit;
    }
  }
  return parsed;
}
export function currentSearchBackfillVersion(): SearchVersionForBackfill & { embeddingModel: string } {
  const embeddingModel = embeddingModelId();
  return {
    embeddingModel,
    embeddingVersion: `${embeddingModel}:${embeddingDims()}`,
    promptVersion: PROMPT_VERSION,
  };
}
export function shouldBackfillFamily(family: FontFamilyDoc, version: SearchVersionForBackfill, force: boolean): boolean {
  if (family.status === "merged" || family.hidden === true || family.mergedInto || family.aliasOf) return false;
  if (force) return true;
  return !isSearchIndexedAtVersion(family, version);
}
export async function buildBackfillUpdate(family: FontFamilyDoc): Promise<Record<string, unknown>> {
  return buildVersionedBackfillUpdate(family, currentSearchBackfillVersion());
}
if (require.main === module) {
  import("./backfillSearchVectorsRunner").then(({ runBackfillSearchVectors }) => runBackfillSearchVectors()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
