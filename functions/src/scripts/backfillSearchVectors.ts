import { getFirestore, FieldValue, type Query } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { embedText, embeddingDims, embeddingModelId } from "../ai/embeddings";
import { PROMPT_VERSION } from "../ai/enrich/schema";
import type { FontFamilyDoc } from "../models/catalog.models";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import {
  buildLaneEmbeddingText,
  buildSearchDocument,
  isSearchIndexedAtVersion,
  type SearchVectorLane,
} from "../search/searchDocument";

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

const VECTOR_FIELDS: Record<SearchVectorLane, "text_vec" | "mood_vec" | "use_case_vec"> = {
  text: "text_vec",
  mood: "mood_vec",
  useCase: "use_case_vec",
};

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

export function shouldBackfillFamily(
  family: FontFamilyDoc,
  version: SearchVersionForBackfill,
  force: boolean
): boolean {
  if (force) return true;
  return !isSearchIndexedAtVersion(family, version);
}

async function buildBackfillUpdate(family: FontFamilyDoc): Promise<Record<string, unknown>> {
  const version = currentSearchBackfillVersion();
  const familyForSearch: FontFamilyDoc = {
    ...family,
    enrichment: family.enrichment
      ? {
          ...family.enrichment,
          embeddingModel: version.embeddingModel,
          embeddingVersion: version.embeddingVersion,
          promptVersion: family.enrichment.promptVersion ?? version.promptVersion,
        }
      : family.enrichment,
  };

  const searchDoc = buildSearchDocument(familyForSearch, version);
  const update: Record<string, unknown> = {
    ...searchDoc,
    searchMeta: {
      ...searchDoc.searchMeta,
      generatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  await Promise.all(
    (Object.keys(VECTOR_FIELDS) as SearchVectorLane[]).map(async (lane) => {
      const vector = await embedText(buildLaneEmbeddingText(familyForSearch, lane), "RETRIEVAL_DOCUMENT");
      if (vector) update[VECTOR_FIELDS[lane]] = FieldValue.vector(vector);
    })
  );

  return update;
}

async function run(): Promise<void> {
  if (!getApps().length) initializeApp();
  const args = parseBackfillArgs(process.argv.slice(2));
  const version = currentSearchBackfillVersion();
  const db = getFirestore();

  let query: Query = db.collection(FAMILIES_COLLECTION);
  if (args.ownerId) query = query.where("ownerId", "==", args.ownerId);
  if (args.limit) query = query.limit(args.limit);

  const snap = await query.get();
  let skipped = 0;
  let updated = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const family = doc.data() as FontFamilyDoc;
    if (!shouldBackfillFamily(family, version, args.force)) {
      skipped += 1;
      continue;
    }

    try {
      if (!args.dryRun) {
        const update = await buildBackfillUpdate(family);
        await doc.ref.set(update, { merge: true });
      }
      updated += 1;
      console.log(`${args.dryRun ? "would update" : "updated"} ${doc.id}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`failed ${doc.id}: ${message}`);
    }
  }

  console.log(JSON.stringify({ scanned: snap.size, skipped, updated, failed, dryRun: args.dryRun }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
