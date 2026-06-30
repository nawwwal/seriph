import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../models/catalog.models";
import {
  DEFAULT_SEARCH_WEIGHTS,
  exactMatchScore,
  fuseCandidateScore,
  mergeSearchCandidate,
  qualityScore,
  semanticScoreFromDistance,
} from "./scoring";
import { SEARCH_VECTOR_LANES } from "./searchDocument";
import { canonicalSearchClassification } from "./searchClassification";
import { matchesSearchFilters } from "./searchFilters";
import type { SearchRequest, SearchResultItem } from "./searchTypes";

export function toSearchItem(family: FontFamilyDoc, score?: number, scoreBreakdown?: SearchResultItem["scoreBreakdown"]): SearchResultItem {
  const cover = family.faces?.find((face) => face.id === family.coverFaceId) || family.faces?.[0];
  return {
    id: family.id,
    slug: family.slug,
    name: family.name,
    category: family.category,
    classification: canonicalSearchClassification(family.enrichment?.classification) ?? canonicalSearchClassification(family.classification) ?? family.classification,
    summary: family.enrichment?.summary,
    moods: family.enrichment?.moods,
    useCases: family.enrichment?.useCases,
    coverUrl: cover?.woff2?.url,
    styleCount: family.faces?.length ?? 0,
    isVariable: family.faces?.some((face) => face.isVariable) ?? false,
    updatedAt: typeof family.updatedAt === "string" ? family.updatedAt : "",
    score,
    ...(scoreBreakdown ? { scoreBreakdown } : {}),
  };
}

export function rankSearchDocs({
  vectorDocsByLane,
  exactDocs,
  normalizedQuery,
  req,
  topK,
}: {
  vectorDocsByLane: QueryDocumentSnapshot[][];
  exactDocs: QueryDocumentSnapshot[];
  normalizedQuery: string;
  req: SearchRequest;
  topK: number;
}): SearchResultItem[] {
  const candidates = new Map<string, ReturnType<typeof mergeSearchCandidate>>();

  for (const [index, docs] of vectorDocsByLane.entries()) {
    const lane = SEARCH_VECTOR_LANES[index];
    for (const doc of docs) {
      mergeSearchCandidate(candidates, { ...doc.data(), id: doc.id } as FontFamilyDoc, { lane, score: semanticScoreFromDistance(doc.get("_distance")) });
    }
  }

  for (const doc of exactDocs) {
    const family = { ...doc.data(), id: doc.id } as FontFamilyDoc;
    mergeSearchCandidate(candidates, family, { exact: exactMatchScore(normalizedQuery, family) });
  }

  return [...candidates.values()]
    .map((candidate) => {
      const scores = {
        ...candidate.scores,
        exact: Math.max(candidate.scores.exact, exactMatchScore(normalizedQuery, candidate.family)),
        quality: qualityScore(candidate.family),
      };
      return { family: candidate.family, score: fuseCandidateScore(scores, DEFAULT_SEARCH_WEIGHTS), scores };
    })
    .filter(({ family }) => matchesSearchFilters(family, req))
    .sort((a, b) => b.score - a.score || a.family.name.localeCompare(b.family.name))
    .slice(0, topK)
    .map(({ family, score, scores }) => toSearchItem(family, score, req.debug ? scores : undefined));
}
