import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getOrCreateQueryEmbedding } from "./queryEmbeddingCache";
import { analyzeQueryIntent } from "./queryIntent";
import { applyStructuredFilters, isAliasFamily } from "./searchFilters";
import { runExactLane, runVectorLane } from "./searchLanes";
import { rankSearchDocs } from "./searchResults";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { catalogFamilyDocCandidates } from "../storage/catalogIdentity";
import { asNumberVector } from "./vectorValue";
import { lanesForIntent, weightsForIntent, type SearchIntent } from "../ai/jev/search/intent";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { SearchRequest, SearchResultItem } from "./searchTypes";
import type { SearchVectorLane } from "./searchDocumentTypes";

async function similarVector(db: Firestore, req: SearchRequest): Promise<number[] | null> {
  const target = req.similarTo?.trim();
  const ownerId = req.filters?.ownerId;
  if (!target || target === "." || target === ".." || target.includes("/")) return null;
  for (const id of catalogFamilyDocCandidates(ownerId, target)) {
    const snap = await db.collection(FAMILIES_COLLECTION).doc(id).get();
    if (!snap.exists) continue;
    const family = { ...snap.data(), id: snap.id } as FontFamilyDoc;
    if ((ownerId && family.ownerId !== ownerId) || isAliasFamily(family)) continue;
    const stored = asNumberVector(family.text_vec) ?? asNumberVector(family.image_vec);
    if (stored) return stored;
  }
  return getOrCreateQueryEmbedding({ db, query: target });
}

function withQueryConstraints(req: SearchRequest, analyzed: ReturnType<typeof analyzeQueryIntent>): SearchRequest {
  const filters = { ...req.filters };
  if (!filters.classifications?.length && analyzed.inferredClass) {
    filters.classifications = [analyzed.inferredClass];
  }
  if ((!filters.variable || filters.variable === "any") && filters.isVariable === undefined && analyzed.requiresVariable) {
    filters.variable = "variable";
  }
  return { ...req, filters };
}

export async function retrieveSearchDocs(
  req: SearchRequest,
  normalizedQuery: string,
  intentPromise: Promise<SearchIntent | undefined>,
  topK: number,
  queryVectorPromise?: Promise<number[] | null>,
): Promise<SearchResultItem[]> {
  const db = getFirestore();
  const analyzed = analyzeQueryIntent(normalizedQuery);
  const constrainedReq = req.similarTo ? req : withQueryConstraints(req, analyzed);
  const base = applyStructuredFilters(db.collection(FAMILIES_COLLECTION), constrainedReq);
  const exactPromise = normalizedQuery ? runExactLane(base, normalizedQuery, topK) : Promise.resolve([]);
  const intent = (await intentPromise) ?? analyzed.intent;
  const lanes: SearchVectorLane[] = req.similarTo ? ["image", "text"] : lanesForIntent(intent);
  const vector = req.similarTo
    ? await similarVector(db, req)
    : lanes.length
      ? await (queryVectorPromise ?? getOrCreateQueryEmbedding({ db, query: normalizedQuery }))
      : null;
  const vectorDocsByLane: Array<{ lane: SearchVectorLane; docs: QueryDocumentSnapshot[] }> = vector
    ? await Promise.all(lanes.map(async (lane) => ({ lane, docs: await runVectorLane(base, lane, vector, topK) })))
    : [];
  return rankSearchDocs({
    vectorDocsByLane,
    exactDocs: await exactPromise,
    normalizedQuery,
    req: constrainedReq,
    topK,
    weights: weightsForIntent(req.similarTo ? "similar" : intent),
  });
}
