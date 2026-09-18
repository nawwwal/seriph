import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean, getConfigNumber } from "../../../config/remoteConfig";
import { evaluateSystemOne, choiceConfidence, choiceValue } from "../client";
import type { SearchRequest } from "../../../search/searchTypes";
import { SEARCH_INTENTS, intentQuestions, type SearchIntent } from "./intent";

function taxonomyQuestions(): Record<string, unknown> {
  return intentQuestions();
}

export async function interpretSearchQuery(query: string, filters: SearchRequest["filters"]): Promise<{
  intent?: SearchIntent;
  filters: SearchRequest["filters"];
}> {
  if (!getConfigBoolean(RC_KEYS.jevSearchIntentEnabled, false)) return { filters };
  try {
    const result = await evaluateSystemOne({ query }, taxonomyQuestions(), { maxAttempts: 1, timeoutMs: 250 });
    const picked = choiceValue(result, "intent");
    const intent = SEARCH_INTENTS.includes(picked as SearchIntent) ? picked as SearchIntent : undefined;
    const minConfidence = getConfigNumber(RC_KEYS.jevIntentConfidenceMin, 0.5);
    if (!intent || choiceConfidence(result, "intent") < minConfidence) return { filters };
    // Query-derived moods and use cases steer lane weights through `intent`.
    // They must not become hard filters: only explicit user filters may exclude
    // candidates from the result set.
    return { intent, filters };
  } catch {
    return { filters };
  }
}
