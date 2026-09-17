import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean } from "../../../config/remoteConfig";
import { evaluateSystemOne, noulValue, questionId } from "../client";
import type { SearchIntent } from "./intent";
import type { SearchResultItem } from "../../../search/searchTypes";

const RERANK_LIMIT = 20;
const HAS_MATCH = "catalog_has_match";

function compactHit(item: SearchResultItem) {
  return {
    id: item.id,
    name: item.name,
    classification: item.classification,
    moods: item.moods,
    useCases: item.useCases,
    summary: (item.summary ?? "").slice(0, 180),
  };
}

function matchNoul(item: SearchResultItem) {
  return {
    type: "noul",
    instructions: `Could the candidate with id ${item.id} named ${item.name} be what \`query\` is looking for? Judge only that candidate, not the rest of \`candidates\`.`,
    criteria: {
      true: "This candidate is a genuine match for the query.",
      false: "Wrong family, wrong job, or only loosely related.",
    },
  };
}

export async function rerankSearchResults(
  query: string,
  intent: SearchIntent | undefined,
  results: SearchResultItem[],
  debug?: boolean,
): Promise<SearchResultItem[]> {
  const enabled = getConfigBoolean(RC_KEYS.jevSearchRerankEnabled, false) || getConfigBoolean(RC_KEYS.searchEnableRerank, false);
  if (!enabled || !query.trim() || intent === "name" || results.length === 0) return results;
  const shortlist = results.slice(0, RERANK_LIMIT);
  try {
    const questions: Record<string, unknown> = {
      [HAS_MATCH]: {
        type: "noul",
        instructions: "Does any item in `candidates` genuinely match `query`?",
        criteria: {
          true: "At least one candidate is a real match.",
          false: "The shortlist is misses or only loose associations.",
        },
      },
    };
    for (const item of shortlist) questions[questionId("r", item.id)] = matchNoul(item);
    const judged = await evaluateSystemOne({ query, candidates: shortlist.map(compactHit) }, questions);
    const ranked = noulValue(judged, HAS_MATCH) > 0.5
      ? [...shortlist].sort((a, b) => {
        const delta = noulValue(judged, questionId("r", b.id)) - noulValue(judged, questionId("r", a.id));
        return delta || (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name);
      })
      : shortlist;
    const rest = results.slice(RERANK_LIMIT);
    return [...ranked, ...rest].map((item) => {
      if (!debug) return item;
      const base = item.scoreBreakdown ?? { textSemantic: 0, moodSemantic: 0, useCaseSemantic: 0, exact: 0, quality: 0 };
      return { ...item, scoreBreakdown: { ...base, rerank: noulValue(judged, questionId("r", item.id)) } };
    });
  } catch {
    return results;
  }
}
