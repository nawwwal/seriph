import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { MOODS, USE_CASES, type Mood, type UseCase } from "../../models/contracts";
import { RC_KEYS } from "../../config/rcKeys";
import { getConfigNumber, getConfigValue } from "../../config/remoteConfig";
import { canonicalSearchClassification, SEARCH_CLASSES } from "../../search/searchClassification";
import { JEV_VERSION } from "../enrich/schema";
import {
  choiceConfidence,
  choiceValue,
  evaluateSystemOne,
  nearestScoreLevel,
  noulValue,
  scoreLevelProbability,
  type SystemOneResult,
} from "./client";
import { catalogLabelQuestions, moodQuestionId, useCaseQuestionId } from "./questions";
import { USE_CASE_LEVELS } from "./score";

export interface JevLabelMaps {
  searchClass?: string;
  moodScores: Record<string, number>;
  useCaseScores: Record<string, number>;
  moods: Mood[];
  useCases: UseCase[];
}

function judgedSearchClass(result: SystemOneResult, minConfidence: number, fallbacks: string[]): string | undefined {
  const picked = choiceValue(result, "searchClass");
  const valid = picked && (SEARCH_CLASSES as readonly string[]).includes(picked) ? picked : undefined;
  if (valid && choiceConfidence(result, "searchClass") >= minConfidence) return valid;
  for (const text of fallbacks) {
    const canonical = canonicalSearchClassification(text);
    if (canonical) return canonical;
  }
  return valid;
}

export function mapsFromResult(
  result: SystemOneResult,
  moodThreshold: number,
  classFallback?: { texts: string[]; minConfidence: number },
): JevLabelMaps {
  const moodScores: Record<string, number> = {};
  const useCaseScores: Record<string, number> = {};
  const moods: Mood[] = [];
  const useCases: UseCase[] = [];
  for (const mood of MOODS) {
    const value = noulValue(result, moodQuestionId(mood));
    moodScores[mood] = value;
    if (value >= moodThreshold) moods.push(mood);
  }
  const possible: UseCase[] = [];
  for (const useCase of USE_CASES) {
    const id = useCaseQuestionId(useCase);
    const level = nearestScoreLevel(result, id, USE_CASE_LEVELS.length);
    useCaseScores[useCase] = level;
    if (scoreLevelProbability(result, id, 2) >= 0.5) useCases.push(useCase);
    else if (level === 1) possible.push(useCase);
  }
  if (!useCases.length) useCases.push(...possible.slice(0, 3));
  return {
    moodScores,
    useCaseScores,
    moods,
    useCases,
    searchClass: judgedSearchClass(result, classFallback?.minConfidence ?? 0, classFallback?.texts ?? []),
  };
}

export async function labelFamilyWithJev(family: FontFamilyDoc, enrichment: FontEnrichment): Promise<FontEnrichment> {
  const result = await evaluateSystemOne({
    family: {
      name: family.name,
      classification: family.classification ?? family.enrichment?.classification ?? null,
      foundry: family.foundry ?? family.designer ?? null,
      styles: family.faces.map((face) => face.styleName),
    },
    summary: enrichment.summary ?? "",
    voice: enrichment.voice ?? "",
    geminiMoods: enrichment.moods ?? [],
    geminiUseCases: enrichment.useCases ?? [],
    geminiClassification: enrichment.classification ?? "",
  }, catalogLabelQuestions());
  const maps = mapsFromResult(result, getConfigNumber(RC_KEYS.jevMoodThreshold, 0.7), {
    minConfidence: getConfigNumber(RC_KEYS.jevIntentConfidenceMin, 0.5),
    texts: [enrichment.classification ?? "", family.classification ?? "", family.name, enrichment.summary ?? ""],
  });
  return {
    ...enrichment,
    moods: maps.moods,
    useCases: maps.useCases,
    moodScores: maps.moodScores,
    useCaseScores: maps.useCaseScores,
    searchClass: maps.searchClass,
    jevModel: result.model || getConfigValue(RC_KEYS.jevModelName, "jev-1.13.0"),
    jevVersion: JEV_VERSION,
  };
}
