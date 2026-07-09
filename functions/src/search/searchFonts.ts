/**
 * Fast semantic font search over the unified text vector and exact-token lane.
 */
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getConfigNumber } from "../config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "../config/rcKeys";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { getOrCreateQueryEmbedding } from "./queryEmbeddingCache";
import { normalizeSearchText } from "./searchDocument";
import { applyStructuredFilters, fetchSearchableListing } from "./searchFilters";
import { runExactLane, runVectorLane } from "./searchLanes";
import { rankSearchDocs, toSearchItem } from "./searchResults";
import type { SearchRequest, SearchResultItem } from "./searchTypes";

export type { SearchRequest, SearchResultItem } from "./searchTypes";

function searchLimit(requested: number | undefined): number {
  const fallback = getConfigNumber(RC_KEYS.searchTopK, Number(RC_DEFAULTS[RC_KEYS.searchTopK]));
  return Math.min(100, Math.max(1, Math.floor(requested ?? fallback)));
}

export async function searchFonts(req: SearchRequest): Promise<{ results: SearchResultItem[] }> {
  const totalStarted = Date.now();
  const db = getFirestore();
  const topK = searchLimit(req.limit);
  const normalizedQuery = normalizeSearchText(req.q || "");
  const base = applyStructuredFilters(db.collection(FAMILIES_COLLECTION), req);

  if (!normalizedQuery) {
    const listing = await fetchSearchableListing(base, req, topK);
    logger.info("search fallback listing complete", { count: listing.length, totalMs: Date.now() - totalStarted });
    return { results: listing.map((family) => toSearchItem(family)) };
  }

  const exactPromise = runExactLane(base, normalizedQuery, topK);
  const embeddingStarted = Date.now();
  const vector = await getOrCreateQueryEmbedding({ db, query: normalizedQuery });
  const vectorDocs = vector ? await runVectorLane(base, "text", vector, topK) : [];
  logger.info("search semantic lane complete", { embeddingMs: Date.now() - embeddingStarted, vectorCount: vectorDocs.length });
  const exactDocs = await exactPromise;
  let results = rankSearchDocs({ vectorDocsByLane: [vectorDocs], exactDocs, normalizedQuery, req, topK });

  if (results.length === 0) {
    const fallbackDocs = await fetchSearchableListing(base, req, topK);
    results = fallbackDocs
      .map((family) => toSearchItem(family))
      .filter((item) => item.name || item.slug);
  }

  logger.info("search complete", { results: results.length, totalMs: Date.now() - totalStarted });
  return { results };
}
