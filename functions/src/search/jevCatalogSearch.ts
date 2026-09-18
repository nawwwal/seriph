import type { Firestore } from "firebase-admin/firestore";
import { evaluateSystemOne, choiceProbabilities, noulValue } from "../ai/jev/client";
import type { FontFamilyDoc } from "../models/catalog.models";
import { exactMatchScore, qualityScore } from "./scoring";
import { matchesSearchFilters } from "./searchFilters";
import { SEARCH_RESULT_FIELDS } from "./searchLanes";
import { toSearchItem } from "./searchResults";
import type { SearchRequest, SearchResultItem } from "./searchTypes";

const CACHE_TTL_MS = 30 * 60 * 1000;
const JEV_CANDIDATE_LIMIT = 48;
let catalogCache: { expiresAt: number; families: FontFamilyDoc[] } | undefined;
let catalogLoad: Promise<FontFamilyDoc[]> | undefined;

function candidateText(family: FontFamilyDoc): string {
  const enrichment = family.enrichment;
  return [
    family.name,
    family.classification,
    family.foundry,
    enrichment?.summary,
    enrichment?.voice,
    enrichment?.moods?.join(", "),
    enrichment?.useCases?.join(", "),
    family.searchText,
  ].filter(Boolean).join("; ").slice(0, 320);
}

async function loadActiveCatalog(db: Firestore): Promise<FontFamilyDoc[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.families;
  if (catalogLoad) return catalogLoad;
  catalogLoad = db.collection("fontfamilies")
    // Search only traverses publishable families.  Keeping the owner filter in
    // memory avoids an owner/status composite index while excluding merged and
    // in-progress imports before they cross the network.
    .where("status", "in", ["ready", "enriched"])
    .select(...SEARCH_RESULT_FIELDS)
    .get()
    .then((snap) => snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as FontFamilyDoc))
    .then((families) => {
      catalogCache = { expiresAt: Date.now() + CACHE_TTL_MS, families };
      return families;
    })
    .finally(() => { catalogLoad = undefined; });
  return catalogLoad;
}

async function loadCatalog(db: Firestore, ownerId: string): Promise<FontFamilyDoc[]> {
  return (await loadActiveCatalog(db)).filter((family) => family.ownerId === ownerId);
}

/** Start the compact catalog read while request authentication is in flight. */
export async function primeSearchCatalog(db: Firestore): Promise<void> {
  await loadActiveCatalog(db);
}

function rankedCandidates(families: FontFamilyDoc[], query: string, req: SearchRequest): FontFamilyDoc[] {
  const queryTokens = query.split(/\s+/).filter((token) => token.length > 1);
  const lexicalScore = (family: FontFamilyDoc): number => {
    const text = `${family.name} ${family.searchText ?? ""}`.toLowerCase();
    if (!queryTokens.length) return 0;
    return queryTokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0) / queryTokens.length;
  };
  return families
    .filter((family) => matchesSearchFilters(family, req))
    .sort((a, b) => {
      const exactDelta = exactMatchScore(query, b) - exactMatchScore(query, a);
      return exactDelta || lexicalScore(b) - lexicalScore(a) || a.name.localeCompare(b.name);
    })
    .slice(0, JEV_CANDIDATE_LIMIT);
}

export async function searchCatalogWithJev(
  db: Firestore,
  req: SearchRequest,
  query: string,
  topK: number,
): Promise<SearchResultItem[] | null> {
  const ownerId = req.filters?.ownerId;
  if (!ownerId || !query || req.similarTo) return null;
  try {
    const candidates = rankedCandidates(await loadCatalog(db, ownerId), query, req);
    if (!candidates.length) return [];
    const ids = candidates.map((_, index) => `F${String(index).padStart(3, "0")}`);
    const state = candidates.map((family, index) => `${ids[index]}| ${candidateText(family)}`).join("\n");
    const result = await evaluateSystemOne(state, {
      relevant: {
        type: "choice",
        instructions: `Which font best matches this search request: "${query}"? Rank by meaning, mood, intended use, description, tags, and typographic details.`,
        criteria: Object.fromEntries(ids.map((id) => [id, null])),
      },
      hasMatch: {
        type: "noul",
        instructions: `Does at least one font genuinely match this search request: "${query}"?`,
        criteria: { true: "At least one font is a useful match.", false: "The catalog has no useful match." },
      },
    }, { maxAttempts: 1, timeoutMs: 550 });
    const probabilities = choiceProbabilities(result, "relevant");
    const maxProbability = Math.max(...ids.map((id) => probabilities[id] ?? 0), 0.0001);
    const hasMatch = noulValue(result, "hasMatch");
    return candidates
      .map((family, index) => {
        const semantic = (probabilities[ids[index]] ?? 0) / maxProbability;
        const exact = exactMatchScore(query, family);
        const quality = qualityScore(family);
        return { family, score: semantic * 0.75 + exact * 0.2 + quality * 0.05 };
      })
      .sort((a, b) => b.score - a.score || a.family.name.localeCompare(b.family.name))
      .slice(0, topK)
      .map(({ family, score }) => toSearchItem(family, score, req.debug ? {
        textSemantic: hasMatch,
        moodSemantic: 0,
        useCaseSemantic: 0,
        exact: exactMatchScore(query, family),
        quality: qualityScore(family),
        rerank: score,
      } : undefined));
  } catch {
    return null;
  }
}
