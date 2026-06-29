import type { FontFamilyDoc } from "../models/catalog.models";

export interface SearchWeights {
  textSemantic: number;
  moodSemantic: number;
  useCaseSemantic: number;
  exact: number;
  quality: number;
}

export interface SearchScoreBreakdown {
  textSemantic: number;
  moodSemantic: number;
  useCaseSemantic: number;
  exact: number;
  quality: number;
}

export interface SearchCandidate {
  family: FontFamilyDoc;
  scores: SearchScoreBreakdown;
}

export const DEFAULT_SEARCH_WEIGHTS: SearchWeights = {
  textSemantic: 0.45,
  moodSemantic: 0.2,
  useCaseSemantic: 0.2,
  exact: 0.1,
  quality: 0.05,
};

export const EMPTY_SCORES: SearchScoreBreakdown = {
  textSemantic: 0,
  moodSemantic: 0,
  useCaseSemantic: 0,
  exact: 0,
  quality: 0,
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
