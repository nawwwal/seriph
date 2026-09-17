import { MOODS, USE_CASES } from "../../models/contracts";
import { SEARCH_CLASSES } from "../../search/searchClassification";
import { scoreQuestion, USE_CASE_LEVELS } from "./score";

export function moodQuestionId(mood: string): string {
  return `mood_${mood}`;
}

export function useCaseQuestionId(useCase: string): string {
  return `use_${useCase}`;
}

const SEARCH_CLASS_CRITERIA: Record<(typeof SEARCH_CLASSES)[number], string> = {
  Serif: "Serifs on the letters. Text romans, oldstyle, transitional, didone. Not sans.",
  "Sans Serif": "No serifs. Grotesque, humanist, geometric, neo-grotesque.",
  "Script & Handwriting": "Connecting or written letters, calligraphy, casual handwriting.",
  Monospace: "Fixed-width letters for code or tabular work.",
  "Display & Decorative": "Poster, ornamental, or specialty display; not a workhorse text face.",
  "Symbol & Icon": "Dingbats, icons, ornaments; not a reading alphabet.",
};

export function catalogLabelQuestions(): Record<string, unknown> {
  const questions: Record<string, unknown> = {
    searchClass: {
      type: "choice",
      instructions: "Which search facet class is this typeface? Judge the typeface from `summary` and `family`, not `geminiClassification` wording.",
      criteria: SEARCH_CLASS_CRITERIA,
    },
  };
  for (const mood of MOODS) {
    questions[moodQuestionId(mood)] = {
      type: "noul",
      instructions: `Does this typeface's character match ${mood}? Judge the typeface, not whether the word appears in \`geminiMoods\`.`,
      criteria: { true: `Character is ${mood}.`, false: `Character is not ${mood}.` },
    };
  }
  for (const useCase of USE_CASES) {
    questions[useCaseQuestionId(useCase)] = scoreQuestion(
      `How suitable is this typeface for ${useCase.replace(/_/g, " ")} given \`summary\` and \`family\`?`,
      USE_CASE_LEVELS,
    );
  }
  return questions;
}
