import type { SearchRequest } from "../../../search/searchTypes";
import type { SearchVectorLane } from "../../../search/searchDocumentTypes";
import type { SearchWeights } from "../../../search/scoringTypes";
import { DEFAULT_SEARCH_WEIGHTS } from "../../../search/scoringTypes";

export type SearchIntent = "name" | "vibe" | "job" | "similar" | "browse";

export const SEARCH_INTENTS: SearchIntent[] = ["name", "vibe", "job", "similar", "browse"];

export function intentQuestions(): Record<string, unknown> {
  return {
    intent: {
      type: "choice",
      instructions: "What is the searcher trying to do with `query`?",
      criteria: {
        name: "Looking up a specific family or foundry name.",
        vibe: "Describing mood, era, or visual character.",
        job: "Naming a use such as UI, editorial, code, or posters.",
        similar: "Asking for fonts like another font.",
        browse: "Open-ended browsing without a clear name, vibe, or job.",
      },
    },
    variable: {
      type: "noul",
      instructions: "Does `query` ask specifically for a variable font?",
      criteria: { true: "Variable or axis mentioned as a requirement.", false: "No variable requirement." },
    },
  };
}

export function lanesForIntent(intent: SearchIntent | undefined): SearchVectorLane[] {
  if (intent === "vibe") return ["mood", "text"];
  if (intent === "job") return ["useCase", "text"];
  if (intent === "name") return [];
  return ["text"];
}

export function weightsForIntent(intent: SearchIntent | undefined): SearchWeights {
  if (intent === "name") return { textSemantic: 0.1, moodSemantic: 0, useCaseSemantic: 0, exact: 0.8, quality: 0.1 };
  if (intent === "vibe") return { textSemantic: 0.2, moodSemantic: 0.5, useCaseSemantic: 0.1, exact: 0.1, quality: 0.1 };
  if (intent === "job") return { textSemantic: 0.2, moodSemantic: 0.1, useCaseSemantic: 0.5, exact: 0.1, quality: 0.1 };
  return DEFAULT_SEARCH_WEIGHTS;
}

export function mergeIntentFilters(base: SearchRequest["filters"], extra: SearchRequest["filters"]): SearchRequest["filters"] {
  return {
    ...base,
    ...extra,
    classifications: unique([...(base?.classifications ?? []), ...(extra?.classifications ?? [])]),
    moods: unique([...(base?.moods ?? []), ...(extra?.moods ?? [])]),
    useCases: unique([...(base?.useCases ?? []), ...(extra?.useCases ?? [])]),
    styleRanges: extra?.styleRanges?.length ? extra.styleRanges : base?.styleRanges,
    variable: extra?.variable && extra.variable !== "any" ? extra.variable : base?.variable,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
