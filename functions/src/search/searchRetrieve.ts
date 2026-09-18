import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getOrCreateQueryEmbedding } from "./queryEmbeddingCache";
import { applyStructuredFilters, fetchSearchableListing } from "./searchFilters";
import { runExactLane, runVectorLane } from "./searchLanes";
import { rankSearchDocs, toSearchItem } from "./searchResults";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { catalogFamilyDocCandidates } from "../storage/catalogIdentity";
import { asNumberVector } from "./vectorValue";
import { lanesForIntent, weightsForIntent, type SearchIntent } from "../ai/jev/search/intent";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { SearchRequest, SearchResultItem } from "./searchTypes";
import type { SearchVectorLane } from "./searchDocumentTypes";

async function similarVector(db: Firestore, req: SearchRequest): Promise<number[] | null> {
  if (!req.similarTo) return null;
  for (const id of catalogFamilyDocCandidates(req.filters?.ownerId, req.similarTo)) {
    const snap = await db.collection(FAMILIES_COLLECTION).doc(id).get();
    if (!snap.exists) continue;
    const family = { ...snap.data(), id: snap.id } as FontFamilyDoc;
    const stored = asNumberVector(family.text_vec);
    if (stored) return stored;
  }
  return getOrCreateQueryEmbedding({ db, query: req.similarTo });
}

export async function retrieveSearchDocs(
  req: SearchRequest,
  normalizedQuery: string,
  intentPromise: Promise<SearchIntent | undefined>,
  topK: number,
  queryVectorPromise?: Promise<number[] | null>,
): Promise<SearchResultItem[]> {
  const db = getFirestore();
  const base = applyStructuredFilters(db.collection(FAMILIES_COLLECTION), req);
  const exactPromise = normalizedQuery ? runExactLane(base, normalizedQuery, topK) : Promise.resolve([]);
  const intent = await intentPromise;
  const lanes: SearchVectorLane[] = req.similarTo ? ["text"] : lanesForIntent(intent);
  const vector = req.similarTo
    ? await similarVector(db, req)
    : lanes.length
      ? await (queryVectorPromise ?? getOrCreateQueryEmbedding({ db, query: normalizedQuery }))
      : null;
  const vectorDocsByLane: Array<{ lane: SearchVectorLane; docs: QueryDocumentSnapshot[] }> = vector
    ? await Promise.all(lanes.map(async (lane) => ({ lane, docs: await runVectorLane(base, lane, vector, topK) })))
    : [];
  const ranked = rankSearchDocs({
    vectorDocsByLane, exactDocs: await exactPromise, normalizedQuery, req, topK, weights: weightsForIntent(req.similarTo ? "similar" : intent),
  });
  if (ranked.length) return ranked;
  const fallback = await fetchSearchableListing(base, req, topK);
  return fallback.map((family) => toSearchItem(family)).filter((item) => item.name || item.slug);
}
