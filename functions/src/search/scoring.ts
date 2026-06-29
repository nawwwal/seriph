import type { FontFamilyDoc } from "../models/catalog.models";
import { normalizeSearchText, tokenizeSearchText, type SearchVectorLane } from "./searchDocument";
import { DEFAULT_SEARCH_WEIGHTS, EMPTY_SCORES, clamp01, type SearchCandidate, type SearchScoreBreakdown, type SearchWeights } from "./scoringTypes";

export { DEFAULT_SEARCH_WEIGHTS };
export type { SearchCandidate, SearchScoreBreakdown, SearchWeights };

export function semanticScoreFromDistance(distance: unknown): number {
  return typeof distance === "number" ? clamp01(1 - distance) : 0;
}

function nameScore(query: string, family: FontFamilyDoc): number {
  const normalizedName = normalizeSearchText(family.name);
  if (!query || !normalizedName) return 0;
  if (query === normalizedName) return 1;
  if (normalizedName.startsWith(query)) return 0.88;
  if (normalizedName.includes(query)) return 0.78;
  return 0;
}

export function exactMatchScore(rawQuery: string, family: FontFamilyDoc): number {
  const query = normalizeSearchText(rawQuery);
  const queryTokens = tokenizeSearchText([query]);
  if (!queryTokens.length) return 0;

  const tokenSet = new Set(family.searchTokens ?? tokenizeSearchText([
    family.name,
    family.slug,
    family.fileBase,
    family.category,
    family.classification,
    family.enrichment?.classification,
    ...(family.enrichment?.moods ?? []),
    ...(family.enrichment?.useCases ?? []),
  ]));

  const matches = queryTokens.filter((token) => tokenSet.has(token)).length;
  const tokenScore = matches / queryTokens.length;
  const categoryScore = normalizeSearchText(family.category).includes(query) ? 0.8 : 0;
  const classification = normalizeSearchText(family.enrichment?.classification ?? family.classification ?? "");
  const classificationScore = classification.includes(query) ? 0.7 : 0;
  return clamp01(Math.max(nameScore(query, family), tokenScore, categoryScore, classificationScore));
}

export function qualityScore(family: FontFamilyDoc): number {
  const confidence = family.enrichment?.confidence;
  if (typeof confidence === "number") return clamp01(confidence);
  if (family.status === "enriched") return 0.75;
  if (family.status === "ready") return 0.5;
  return 0.25;
}

function laneScoreKey(lane: SearchVectorLane): keyof SearchScoreBreakdown {
  if (lane === "mood") return "moodSemantic";
  if (lane === "useCase") return "useCaseSemantic";
  return "textSemantic";
}

export function mergeSearchCandidate(
  candidates: Map<string, SearchCandidate>,
  family: FontFamilyDoc,
  evidence: { lane?: SearchVectorLane; score?: number; exact?: number; quality?: number }
): SearchCandidate {
  const id = family.id || family.slug;
  const existing = candidates.get(id) ?? { family, scores: { ...EMPTY_SCORES } };
  existing.family = { ...existing.family, ...family };
  if (evidence.lane) {
    const key = laneScoreKey(evidence.lane);
    existing.scores[key] = Math.max(existing.scores[key], clamp01(evidence.score ?? 0));
  }
  if (evidence.exact !== undefined) existing.scores.exact = Math.max(existing.scores.exact, clamp01(evidence.exact));
  if (evidence.quality !== undefined) existing.scores.quality = Math.max(existing.scores.quality, clamp01(evidence.quality));
  candidates.set(id, existing);
  return existing;
}

export function fuseCandidateScore(scores: SearchScoreBreakdown, weights: SearchWeights = DEFAULT_SEARCH_WEIGHTS): number {
  return (
    scores.textSemantic * weights.textSemantic +
    scores.moodSemantic * weights.moodSemantic +
    scores.useCaseSemantic * weights.useCaseSemantic +
    scores.exact * weights.exact +
    scores.quality * weights.quality
  );
}
