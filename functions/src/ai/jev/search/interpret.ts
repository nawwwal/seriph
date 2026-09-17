import { MOODS, USE_CASES } from "../../../models/contracts";
import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean, getConfigNumber } from "../../../config/remoteConfig";
import { evaluateSystemOne, choiceConfidence, choiceValue, noulValue } from "../client";
import type { SearchRequest } from "../../../search/searchTypes";
import { SEARCH_INTENTS, intentQuestions, mergeIntentFilters, type SearchIntent } from "./intent";

const INTENT_MOOD_PREFIX = "intent_mood_";
const INTENT_USE_PREFIX = "intent_use_";

function taxonomyQuestions(): Record<string, unknown> {
  const questions: Record<string, unknown> = intentQuestions();
  for (const mood of MOODS) {
    questions[`${INTENT_MOOD_PREFIX}${mood}`] = {
      type: "noul",
      instructions: `Does \`query\` ask for a typeface whose character is ${mood}?`,
      criteria: { true: `The searcher wants ${mood}.`, false: `Not asking for ${mood}.` },
    };
  }
  for (const useCase of USE_CASES) {
    questions[`${INTENT_USE_PREFIX}${useCase}`] = {
      type: "noul",
      instructions: `Does \`query\` ask for a font for ${useCase.replace(/_/g, " ")}?`,
      criteria: {
        true: `The searcher wants a font for ${useCase.replace(/_/g, " ")}.`,
        false: `Not asking for ${useCase.replace(/_/g, " ")}.`,
      },
    };
  }
  return questions;
}

export async function interpretSearchQuery(query: string, filters: SearchRequest["filters"]): Promise<{
  intent?: SearchIntent;
  filters: SearchRequest["filters"];
}> {
  if (!getConfigBoolean(RC_KEYS.jevSearchIntentEnabled, false)) return { filters };
  try {
    const result = await evaluateSystemOne({ query }, taxonomyQuestions());
    const picked = choiceValue(result, "intent");
    const intent = SEARCH_INTENTS.includes(picked as SearchIntent) ? picked as SearchIntent : undefined;
    const minConfidence = getConfigNumber(RC_KEYS.jevIntentConfidenceMin, 0.5);
    if (!intent || choiceConfidence(result, "intent") < minConfidence) return { filters };
    const threshold = getConfigNumber(RC_KEYS.jevMoodThreshold, 0.7);
    const moods = MOODS.filter((mood) => noulValue(result, `${INTENT_MOOD_PREFIX}${mood}`) >= threshold);
    const useCases = USE_CASES.filter((useCase) => noulValue(result, `${INTENT_USE_PREFIX}${useCase}`) >= threshold);
    const variable = noulValue(result, "variable") >= threshold ? "variable" as const : undefined;
    return { intent, filters: mergeIntentFilters(filters, { moods, useCases, variable }) };
  } catch {
    return { filters };
  }
}
