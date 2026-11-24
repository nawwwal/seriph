/**
 * Fast semantic font search over multi-lane Firestore vectors and exact tokens.
 */
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getConfigNumber } from "../config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "../config/rcKeys";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { interpretSearchQuery } from "../ai/jev/search/interpret";
import { rerankSearchResults } from "../ai/jev/search/rerank";
import { getOrCreateQueryEmbedding } from "./queryEmbeddingCache";
import { analyzeQueryIntent } from "./queryIntent";
import { normalizeSearchText } from "./searchDocument";
import { applyStructuredFilters, fetchSearchableListing } from "./searchFilters";
import { retrieveSearchDocs } from "./searchRetrieve";
import { toSearchItem } from "./searchResults";
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

  if (!normalizedQuery && !req.similarTo) {
    const listing = await fetchSearchableListing(base, req, topK);
    logger.info("search fallback listing complete", { count: listing.length, totalMs: Date.now() - totalStarted });
    return { results: listing.map((family) => toSearchItem(family)) };
  }

  const localIntent = analyzeQueryIntent(normalizedQuery).intent;
  const interpretedPromise = normalizedQuery
    ? interpretSearchQuery(normalizedQuery, req.filters).catch(() => ({ filters: req.filters, intent: localIntent }))
    : Promise.resolve({ filters: req.filters, intent: undefined });
  const queryVectorPromise = normalizedQuery && !req.similarTo
    ? getOrCreateQueryEmbedding({ db, query: normalizedQuery })
    : undefined;
  const ranked = await retrieveSearchDocs(
    req,
    normalizedQuery,
    interpretedPromise.then((value) => value.intent ?? localIntent),
    topK,
    queryVectorPromise,
  );
  const interpreted = await interpretedPromise;
  const results = await rerankSearchResults(normalizedQuery, interpreted.intent ?? localIntent, ranked, req.debug)
    .catch(() => ranked);
  logger.info("search complete", { results: results.length, totalMs: Date.now() - totalStarted });
  return { results };
}
